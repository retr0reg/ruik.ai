## Description:

`deepjavalibrary/djl` expose multiple generation endpoints (`text_generator`,`text2text`,`whisper_speech_recognizer`) with user-specific Hugging-Face `dataset`/`model`. Recently the function `files_util.download_and_extract` was found vulnerable to `Tarslip` vulnerability; patch were implemented as the `safe_extract` method will be use for all extraction actions, nevertheless, the `safe_extract` patch did not considered scenario that `Symlink` files are included in the remote `.tar` file, allowing attackers to create symbol-link files (pointing to confidential files / Model weight files / etc) in the model, which is furtherly loaded by `transformers.pipeline()` in the process.

## Proof of Concept

For generation endpoints `text_generator`,`text2text`,`whisper_speech_recognizer`, `model_url: Optional[str] = None hf_model_id: Optional[str] = None,` is expected for the `pipeline` based generation / classification model of the `generate(` method, which downloads external models via build-in API `files_util.download_and_extract`. After the model being downloaded, it will be parsed to `transfomers.pipeline` to construct a pipeline for user-specific tasks.

```python
class TextGenerator:

    def __init__(self,
                 input_col: str,
                 output_col: str,
                 model_url: Optional[str] = None,
                 hf_model_id: Optional[str] = None,
                 engine: Optional[str] = "PyTorch",
                 batch_size: Optional[str] = 100):
        """
        Initializes the TextGenerator.

        :param input_col: The input column
        :param output_col: The output column
        :param model_url: The model URL
        :param hf_model_id: The Huggingface model ID
        :param engine: The engine. Currently only PyTorch is supported.
        :param batch_size: The batch size.
        """
        self.input_col = input_col
        self.output_col = output_col
        self.model_url = model_url
        self.hf_model_id = hf_model_id
        self.engine = engine
        self.batch_size = batch_size

    def generate(self, dataset, **kwargs):
        """
        Performs text generation on the provided dataset.

        :param dataset: input dataset
        :return: output dataset
        """
        if self.engine is None or self.engine.lower() != "pytorch":
            raise ValueError("Only PyTorch engine is supported.")

        if self.model_url:
            cache_dir = files_util.get_cache_dir(APPLICATION, GROUP_ID,
                                                 self.model_url)
            files_util.download_and_extract(self.model_url, cache_dir)
            dependency_util.install(cache_dir)
            model_id_or_path = cache_dir
        elif self.hf_model_id:
            model_id_or_path = self.hf_model_id
        else:
            raise ValueError(
                "Either model_url or hf_model_id must be provided.")

        @pandas_udf(StringType())
        def predict_udf(iterator: Iterator[pd.Series]) -> Iterator[pd.Series]:
            pipe = pipeline(TASK,
                            model=model_id_or_path,
                            batch_size=self.batch_size,
                            **kwargs)
            for s in iterator:
                output = pipe(s.tolist())
                text = [o[0]["generated_text"] for o in output]
                yield pd.Series(text)

        return dataset.withColumn(self.output_col, predict_udf(self.input_col))
```

#### `download_and_extract`:

```python
def download_and_extract(url, path):
    """Download and extract a tar file.

    :param url: The url of the tar file.
    :param path: The path to the file to download to.
    """

    def is_within_directory(directory, target):
        abs_directory = os.path.abspath(directory)
        abs_target = os.path.abspath(target)
        prefix = os.path.commonprefix([abs_directory, abs_target])
        return prefix == abs_directory

    def safe_extract(tar, path=".", members=None, *, numeric_owner=False):
        for member in tar.getmembers():
            member_path = os.path.join(path, member.name)
            if not is_within_directory(path, member_path):
                raise Exception("Attempted Path Traversal in Tar File")

        tar.extractall(path, members, numeric_owner=numeric_owner)

    if not os.path.exists(path):
        os.makedirs(path)
    if not os.listdir(path):
        with tmpdir() as tmp:
            tmp_file = os.path.join(tmp, "tar_file")
            if url.startswith("s3://"):
                s3_download(url, tmp_file)
                with tarfile.open(name=tmp_file, mode="r:gz") as t:
                    safe_extract(t, path=path)
            elif url.startswith("http://") or url.startswith("https://"):
                with urlopen(url) as response, open(tmp_file, 'wb') as f:
                    shutil.copyfileobj(response, f)
                with tarfile.open(name=tmp_file, mode="r:gz") as t:
                    safe_extract(t, path=path)
```

Here `download_and_extract` parse the external tar file from `s3` bucket or remote stored `http://` URL. With recent spotted [CVE-2024-2914](https://nvd.nist.gov/vuln/detail/CVE-2024-2914) of `Tarslip that leads to arbitary file write in deepjavalibrary/djl`, `safe_extract` and `is_within_directory` is introduced to prevent arbitrary file overwrite via `Path Traversals`.

Nevertheless, the patch failed to considered potential `symlink` file in the `tar` files, with `symlink` attack, we can create a file pointing to arbitrary position on the file system as this:

```python
# Creating a tar file with a symbolic link
def create_malicious_tar():
    with tarfile.open("malicious.tar.gz", "w:gz") as tar:
        os.symlink("arbitrary/position/on/the/system", "malicious_link")
        tar.add("malicious_link", arcname="malicious_link")
```

In which these `symlink` file will be normally parsed in `transformers.pipeline` constructions, which these `symlink` file can be renamed as `merge.txt`, influencing the output of the generation by the file content, as loaded in task:

```python
        @pandas_udf(StringType())
        def predict_udf(iterator: Iterator[pd.Series]) -> Iterator[pd.Series]:
            pipe = pipeline(TASK,
                            model=model_id_or_path,
                            batch_size=self.batch_size,
                            **kwargs)
            for s in iterator:
                output = pipe(s.tolist())
                text = [o[0]["generated_text"] for o in output]
                yield pd.Series(text)

        return dataset.withColumn(self.output_col, predict_udf(self.input_col))
```

Furthermore, as defined `get_cache_dir` in the `files_util.py` context, all downloaded model files will be stored in `get_cache_dir()` defined path with `base_dir, "cache/repo/model"` (`base_dir = os.environ.get("DJL_CACHE_DIR", os.path.join(os.path.expanduser("~"), ".djl.ai"))`)

```python
def get_cache_dir(application, group_id, url):
    """Get the cache directory.

    :param application: The application.
    :param group_id: The group ID.
    :param url: The url of the file to store to the cache.
    """
    base_dir = os.environ.get("DJL_CACHE_DIR",
                              os.path.join(os.path.expanduser("~"), ".djl.ai"))
    h = hashlib.sha256(url.encode('UTF-8')).hexdigest()[:40]
    return os.path.join(base_dir, "cache/repo/model", application, group_id, h)
```

This allows us easy steal other private / previous loaded in the task model since we know it's path patterns by creating a for example `pytorch_model.bin` `symbol-link` files pointing to that position, compromising the `Confidentiality` and exposing these private models

_(`model storage` called as `if self.model_url: cache_dir = files_util.get_cache_dir(APPLICATION, GROUP_ID, self.model_url)`) in `generation` classed_

Demo defined in `https://github.com/deepjavalibrary/djl-demo/blob/master/apache-spark/spark3.0/text-pyspark/text_generation.py`: `text_generation`

```python
import sys
from pyspark.sql.session import SparkSession
from djl_spark.task.text import TextGenerator


if __name__ == "__main__":
    """
        Usage: text_generation.py [output_path]
    """
    output_path = sys.argv[1] if len(sys.argv) > 1 else None
    spark = SparkSession \
        .builder \
        .appName("TextGenerationExample") \
        .getOrCreate()
    sc = spark.sparkContext
    sc.setLogLevel("ERROR")

    # Input
    df = spark.createDataFrame(
        [
            (1, "My name is Julien and I like to"),
            (2, "My name is Thomas and my main"),
            (3, "My name is Mariama, my favorite")
        ],
        ["id", "text"]
    )
    df.show(truncate=False)
    # +---+-------------------------------+
    # |id |text                           |
    # +---+-------------------------------+
    # |1  |My name is Julien and I like to|
    # |2  |My name is Thomas and my main  |
    # |3  |My name is Mariama, my favorite|
    # +---+-------------------------------+

    # Text generation
    generator = TextGenerator(input_col="text",
                              output_col="prediction",
                              hf_model_id="facebook/opt-125m")
    outputDf = generator.generate(df, do_sample=True, max_length=30)

    if output_path:
        print("Saving results S3 path: " + output_path)
        outputDf.write.mode("overwrite").parquet(output_path)
    else:
        print("Printing results output stream")
        outputDf.printSchema()
        # root
        #  |-- id: long (nullable = true)
        #  |-- text: string (nullable = true)
        #  |-- prediction: string (nullable = true)

        outputDf.show(truncate=False)

    spark.stop()
```

similar to report [b064bd2f-bf6e-4fc0-898e-7d02a9b97e24](https://huntr.com/bounties/b064bd2f-bf6e-4fc0-898e-7d02a9b97e24), vulnerable `TextGenerator` is implemented

# Impact

Model Theft & File leakage

## References

- [Previous Tarslip Huntr Report](https://huntr.com/bounties/b064bd2f-bf6e-4fc0-898e-7d02a9b97e24)