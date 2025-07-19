# Description

In `./private_gpt/components/llm/custom/sagemaker.py` 's `SagemakerLLM` class's `complete()`, Since `PrivateGPT` used `eval()` instead of `json.loads()` to load the remote-retrieved string into a dictionary, Python-OS-command injections payload can be parsed the response  of `AWS Sagemaker LLM endpoint` can be predicted and manipulated.

 # Proof of Concept

## Sink

In `./private_gpt/components/llm/custom/sagemaker.py` 's `SagemakerLLM` class's `complete()`, we can see a method used to chat with remote `AWS Sagemaker LLM endpoint`

> Amazon SageMaker is a fully managed service that provides every developer and data scientist with the ability to build, train, and deploy machine learning (ML) models quickly. When it comes to large language models (LLMs), SageMaker offers a robust and scalable platform for managing these complex and resource-intensive models efficiently.

`AWS Sagemaker` is a ML platform of AWS, where user can deploy their ML projects including LLMs, In this case, this method is using  AWS native `boto3` SDK for us to chat with our remote AWS Sagemaker LLM endpoint

### `class SagemakerLLM -> complete()`

First, the process updates the **`self.generate_kwargs`** dictionary by setting the **`"stream"`** key's value to **`False`**, indicating that the text generation task will not utilize stream mode. It then checks the **`"formatted"`** key in the **`kwargs`** dictionary to determine if the input prompt text requires formatting; if **`is_formatted`** is **`False`**, it calls the **`self.completion_to_prompt`** method to format the prompt text accordingly. Next, it prepares the request parameters to be sent to the SageMaker endpoint, which includes the input prompt text, the **`"stream"`** parameter (set to **`False`**), and other inference parameters (**`self.inference_params`**). Using the AWS SDK (boto3 client)'s **`invoke_endpoint`** method, the process sends a request to the specified SageMaker model endpoint with the prepared parameters formatted as JSON. Finally, the response received from the SageMaker endpoint is read and decoded into a string, and the **`eval`** function is used to convert this string into a dictionary.

```python
    @llm_completion_callback()
    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        self.generate_kwargs.update({"stream": False})

        is_formatted = kwargs.pop("formatted", False)
        if not is_formatted:
            prompt = self.completion_to_prompt(prompt)

        request_params = {
            "inputs": prompt,
            "stream": False,
            "parameters": self.inference_params,
        }

        resp = self._boto_client.invoke_endpoint(
            EndpointName=self.endpoint_name,
            Body=json.dumps(request_params),
            ContentType="application/json",
        )
        response_body = resp["Body"]
        response_str = response_body.read().decode("utf-8")
       
        response_dict = eval(response_str) ## VULN

        return CompletionResponse(
            text=response_dict[0]["generated_text"][len(prompt) :], raw=resp
        )
```

However, as we can see in the `Process Response` , `privateGPT` used `eval()` to load remote `JSON format response` (unlike the brother `stream_complete` method), which is **extremely unsafe** since attackers can inject python payloads in to the **response_body of LLM** by **Manipulating the response of LLM** the victim specifics in the `setting.yaml`, LLM's safety may varies. However, since we can control the `System Prompt` via the built-in endpoint of `PrivateGPT`, Controlling the response of LLM will be easy despite the LLM specifics. 

```python
                ## Brother stream_complete() method in the same class
                if line != b"" and start_json in line:
                    data = json.loads(line[line.find(start_json) :].decode("utf-8"))
                    if data["token"]["text"] != stop_token:
                        delta = data["token"]["text"]
```

## Source

By X-Referencing, we found that although most of applications in `privategpt/ui.py` *(The index webpage of` PrivateGPT`)* use the brother `stream_chat()` that is registered under `self._chat_service` which imported from `privategpt/server/chat_service.py` 's `class ChatService`; The `streaming=False` **was also register** in `class ChatService` and also in the `privateGPT/server/chat/chat_router`, which functioned as a `OpenAI-alike` endpoint/

To setup our `privateGPT` we will need to register a application of Sagemaker in AWS, using `Sagemaker jampstart` and etc, After logging into AWS in `aws-cli`, we need to create a `settings-sagemaker.yaml` that contains you `AWS Sagemaker endpoint` informations.

```yaml
llm:
  mode: sagemaker

sagemaker:
  llm_endpoint_name: <endpoint_created>
  embedding_endpoint_name: <embedding_used>
```

After that, we can start the server 

 ```shell
PGPT_PROFILES=sagemaker poetry run python -m private_gpt
 ```

When the server is started ,we can navigate to [http://localhost:8001](http://localhost:8001/) to use the Gradio UI or to http://localhost:8001/docs (API section) to try the API.

As we can see in the official docs of `privateGPT`, a `OpenAI` alike endpoint is also start when we use `poetry run python -m private_gpt` to run the `privategpt` remote server; this endpoint provided us to direct remotely access the vulnerable `sagemaker's` streaming-less `complete() -> CompletionResponse:` using the ` AWS sagemaker LLM`  we can access using the tools such as `curl` or `wget` and etc. API Reference of `privateGPT` can be view at [the official docs of privateGPT](https://docs.privategpt.dev/api-reference/api-reference/contextual-completions/prompt-completion-v-1-completions-post-stream)

For example, this payload will trigger the **vulnerable stream-less** `complete()`under the `privateGPT` `API-endpoint`

```yaml
 $ curl -X 'POST' \                                                       
  'http://localhost:8001/v1/completions' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "include_sources": true,
  "prompt": "This is retr0reg",
  "stream": false, ## Setting streaming to 'false'
  "system_prompt": "Say Hi to retr0reg.",
  "use_context": false
}'
```

## Exploitability


The **exploitability** of this vulnerability hinges on the **misuse** of the `eval()` function within the `SagemakerLLM` class's `complete()` method in the `private_gpt` application. This function is **notoriously unsafe for processing untrusted input** **because it interprets a string as Python code**. In this case, the method receives a string from a **remote AWS SageMaker LLM endpoint**, which is expected to be in JSON format. The use of `eval()` to parse this string into a dictionary introduces a significant security risk because **it can execute arbitrary Python code contained within the response.**

An attacker can exploit this vulnerabilit**y by manipulating the response from the AWS SageMaker LLM endpoint to include malicious Python code**. Since the `private_gpt` application treats the response as trustworthy and executes the `eval()` function on it, any Python code injected by the attacker would be executed by the application. 

The manipulation of the LLM response can be facilitated through several vectors:

```markdown
1. Influence over the LLM's output through crafted inputs: The attacker can control the input to the LLM attackers
might influence the LLM to generate output that includes malicious code, LLM can be tricked into generating such
output.

2. Direct manipulation of the LLM response: 
If the attacker has the ability to intercept or otherwise manipulate the network traffic between the 
`private_gpt` application and the AWS SageMaker endpoint, they could alter legitimate responses to include malicious code.
```

Given that the vulnerable method is part of the functionality allowing interaction with the AWS SageMaker LLM endpoint, and considering the potential for attackers to either directly manipulate the LLM's response or influence its output through crafted inputs, Additionally the endpoint is expose since `uvicorn.run(app, host='0.0.0.0';, port=settings().server.port, log_config=None)` is binding to all interfaces; **the exploitability of this vulnerability is high and confident**. 

### Fixes

Mitigation strategies should include replacing the use of `eval()` with a safer alternative such as `json.loads()` for parsing JSON strings, implementing proper input validation and sanitization to prevent the LLM from generating malicious outputs, and using secure communication channels to protect the integrity of data in transit between the `private_gpt` application and the AWS SageMaker endpoint.