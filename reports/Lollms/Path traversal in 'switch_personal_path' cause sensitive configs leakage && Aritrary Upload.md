# Description
In `./lollms-webui/lollms_core/lollms/server/endpoints/lollms_user.py` `@router.get("/switch_personal_path")`, personal path can be change to arbitrary location on the file system via relative or absolute paths, this firstly causes `Arbitary file uploads`. Nevertheless, due the server it don't remove the cache data in the previous `personal_data` when switching to another, it allow us to leak all files in `personal_data` .

 # Proof of Concept

`/lollms-webui/lollms_core/lollms/server/endpoints/lollms_user.py`: `@router.get("/switch_personal_path")`

```python
class PersonalPathParameters(BaseModel):
    path:str
```

```python
@router.get("/switch_personal_path")
def switch_personal_path(data:PersonalPathParameters):
    path = data.path
    global_paths_cfg = Path("./global_paths_cfg.yaml")
    if global_paths_cfg.exists():
        try:
            cfg = BaseConfig()
            cfg.load_config(global_paths_cfg)
            cfg.lollms_personal_path = path
            cfg.save_config(global_paths_cfg)
            return {"status": True}      
        except Exception as ex:
            print(ex)
            return {"status": False, 'error':f"Couldn't switch path: {ex}"}    
        
```

The `switch_personal_path` function is an API endpoint, designed to update the `lollms_personal_path` entry within a `global_paths_cfg.yaml` file. When called, it receives `PersonalPathParameters` data, specifically a new path. It checks if the global configuration file exists, then attempts to load, modify, and save the configuration with the new path. Upon successful update, it returns a positive status; if an error occurs, such as an issue with file access or parsing, it captures the exception, prints it, and returns a negative status with the error detail.

However, this function failed to sanitize `path = data.path` when `cfg.lollms_personal_path = path`, it allow us to enter a relative path pointing to arbitrary location on the file system.

To exploit this vulnerability, you may use this `poc.py` (`json=`is implemented since `class PersonalPathParameters(BaseModel): path:str` settings,`param`or`data` won't work and will cause 422)

```python
def exploit(
    base_url: str,
    path: str,
):
    
    import requests
    req = requests.get(f'{base_url}/switch_personal_path',
                 json={'path': path},
                 )
    
    if req.status_code == 200:
        print(req.text)
```

## Leakage?

However, the exploitation of this vulnerability do not stops here. due to the fact that don't remove the cache data in the previous personal_data when switching to other one. (e.g. if we switch from `a` to `b`, `personal_data` in `a` will not be removed), we can construct a vector allow us to access beyond the public directories such as `uploads`; By firstly setting `uploads` as our `lollms_personal_path`, the server will transfer or copy the `vict` `personal_data` file into the new one, in this case re-creating `personal_data` under `upload`

After that, since rebinding `lollms_personal_path` will not empty the `dest` folder, we can rebind `lollms_personal_path` to the father directory of `uploads`, thus `uploads` will contain all the data of `lollms_personal_path`, causing leakage

## Furthermore exploitations?

Due to the fact that we just mentioned, the server neither remove the cache data in the previous `personal_data` or empty the directory when we are when switching to other one, it means that same named directory can be binds in different configs which have different security level and functions. For instance this vulnerability will also allow us to overwrite contents in `lollms-webui`->`configs` via `personal_data`->`configs`(Since same named directory exist in `personal_data`,  visiting `personal_data`->`configs` = `lollms-webui`->`configs`). Additionally, configs in `lollms-webui`->`configs` **might be vulnerable to Path traversal leading RCE since their keys are only being checked when inputting, not implementing**. Thus by externally editing `lollms-webui`->`configs`, same vulnerabilities that would leads to RCE can also being exploited since we are editing the configs via a completely different endpoint.