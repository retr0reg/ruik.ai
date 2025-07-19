# Description

In transformer's `transformers.load_tool` *(can be access via `from transformers import tools; tools.load_tool` or `transformers.load_tool`) with`Call-Chain`: `load_tool() -> Tool.from_hub() -> get_class_from_dynamic_module() -> get_class_in_module() -> importlib.import_module(module_path)`; the program will execute arbitrary Python Commands in a maliciously-built repo (without any `HuggingFace` Warnings in Hub and no `trust_remote_code` is required). Causing arbitrary OS Command execution or creating a Reverse-Shell connection or even starting a worm attack via `HuggingFace` Hub.

 # Proof of Concept

`load_tool()`

```python
def load_tool(task_or_repo_id, model_repo_id=None, remote=False, token=None, **kwargs):
    
			# Codes .....
                model_repo_id = endpoints[task_or_repo_id]
            return RemoteTool(model_repo_id, token=token, tool_class=tool_class)
        else:
            return tool_class(model_repo_id, token=token, **kwargs)
    else:
        return Tool.from_hub(task_or_repo_id, model_repo_id=model_repo_id, token=token, remote=remote, **kwargs)
```

The `load_tool` function is designed to load a particular tool or model from a repository. When this function is called, it checks if the tool should be loaded from a remote endpoint or locally. If the tool is to be loaded remotely, it uses the `RemoteTool` class with the appropriate model repository identifier and security token. Otherwise, it loads the tool using the `Tool` class's `from_hub` method, which can handle both local and remote loading scenarios

`@classmethod def from_hub(`

```python
    @classmethod
    def from_hub(
        cls,
        repo_id: str,
        model_repo_id: Optional[str] = None,
        token: Optional[str] = None,
        remote: bool = False,
        **kwargs,
    ):
  		# Codes......
        if resolved_config_file is None:
            resolved_config_file = cached_file(
                repo_id,
                CONFIG_NAME,
                token=token,
                **hub_kwargs,
                _raise_exceptions_for_gated_repo=False,
                _raise_exceptions_for_missing_entries=False,
                _raise_exceptions_for_connection_errors=False,
            )
        if resolved_config_file is None:
            raise EnvironmentError(
                f"{repo_id} does not appear to provide a valid configuration in `tool_config.json` or `config.json`."
            )

        with open(resolved_config_file, encoding="utf-8") as reader:
            config = json.load(reader)

        if not is_tool_config:
            if "custom_tool" not in config:
                raise EnvironmentError(
                    f"{repo_id} does not provide a mapping to custom tools in its configuration `config.json`."
                )
            custom_tool = config["custom_tool"]
        else:
            custom_tool = config

        tool_class = custom_tool["tool_class"]
        tool_class = get_class_from_dynamic_module(tool_class, repo_id, token=token, **hub_kwargs)
```

The `from_hub` method is a class method that facilitates the creation of a tool from a specified repository. This method attempts to fetch a configuration file from the given repository. If it fails to find a valid configuration file, it raises an error. Once it has the configuration, it determines whether it's loading a custom tool and then dynamically loads the required class using the `get_class_from_dynamic_module` function.

`get_class_from_dynamic_module()`

```python
def get_class_from_dynamic_module(
    class_reference: str,
    pretrained_model_name_or_path: Union[str, os.PathLike],
    cache_dir: Optional[Union[str, os.PathLike]] = None,
    force_download: bool = False,
    resume_download: bool = False,
    proxies: Optional[Dict[str, str]] = None,
    token: Optional[Union[bool, str]] = None,
    revision: Optional[str] = None,
    local_files_only: bool = False,
    repo_type: Optional[str] = None,
    code_revision: Optional[str] = None,
    **kwargs,
) -> typing.Type:
	# Codes
    if "--" in class_reference:
        repo_id, class_reference = class_reference.split("--")
    else:
        repo_id = pretrained_model_name_or_path
    module_file, class_name = class_reference.split(".")

    if code_revision is None and pretrained_model_name_or_path == repo_id:
        code_revision = revision
    # And lastly we get the class inside our newly created module
    final_module = get_cached_module_file(
        repo_id,
        module_file + ".py",
        cache_dir=cache_dir,
        force_download=force_download,
        resume_download=resume_download,
        proxies=proxies,
        token=token,
        revision=code_revision,
        local_files_only=local_files_only,
        repo_type=repo_type,
    )
    return get_class_in_module(class_name, final_module.replace(".py", ""))
```

The `get_class_from_dynamic_module` function is responsible for dynamically importing a Python class from a module that is fetched from a specified repository. It first determines the repository identifier and the class reference. Then, it fetches the module file from the cached location, or downloads it if necessary, and finally imports the specified class from the module.

`get_class_in_module`

```python
def get_class_in_module(class_name: str, module_path: Union[str, os.PathLike]) -> typing.Type:
    """
    Import a module on the cache directory for modules and extract a class from it.

    Args:
        class_name (`str`): The name of the class to import.
        module_path (`str` or `os.PathLike`): The path to the module to import.

    Returns:
        `typing.Type`: The class looked for.
    """
    module_path = module_path.replace(os.path.sep, ".")
    module = importlib.import_module(module_path)
    return getattr(module, class_name)
```

Lastly, the `get_class_in_module` function is a utility that imports a module from the cache directory and retrieves a specified class from that module. It modifies the module path to conform to Python's import syntax, imports the module using Python's `importlib`, and then returns the class by its name. This function is crucial for the dynamic loading mechanism, as it allows for classes to be loaded from code that is not natively present in the initial execution environment.

However, the concerns raised when in the `get_class_in_module` function, which is called in a chain started at `load_tool`that loads remote tools in `Hugging-Face Hub`. as `from_hub`saved `custom_tool["tool_class"]` as an argument to `get_class_from_dynamic_module`, which loads the `"tool_class": "text_to_image.TextToImageTool"`. Using `importlib.import_module` to import them. Nevertheless, if the `module_file -> class_name` contains malicious commands or `module_file` contains any, `importlib.import_module` will load them simultaneously while loading the tools without any warnings or executed without `trust_remote_code` . For instance, the attacker can send user's token in `~/.cache/huggingface/token` to remote servers, or create a reverse-shell to remote server.

# PoC Demonstration

![](https://raw.githubusercontent.com/retr0reg/0reg-uploads/main//img/20240312005535.png)

Repo: [https://huggingface.co/Retr0REG/0reg-0reg](https://huggingface.co/Retr0REG/0reg-0reg)

In the *PoC Demonstration*, It had shown that neither `TRUST_REMOTE_CODE`need to be set to `True`, nor any  Hugging-Face Hub Warnings will display in the repo:

[Transformer-RCE-load-tools.mp4](https://drv.0reg.dev/zh-CN/Personals/PoCs/Transformers/Transformer-RCE-load-tools.mp4)