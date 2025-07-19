# Description
`@router.post("/save_settings")` is vulnerable to `Path traversal` exploits since both function didn't exam sanitization on `config = config_data["config"]` 

 # Proof of Concept
`./lollms-webui/lollms_core/lollms/server/endpoints/lollms_configuration_infos.py` -> `apply_settings`

```python

@router.post("/apply_settings")
async def apply_settings(request: Request):
    """
    Endpoint to apply configuration settings.

    :param request: The HTTP request object.
    :return: A JSON response with the status of the operation.
    """
    # Prevent all outsiders from sending something to this endpoint
    forbid_remote_access(lollmsElfServer)
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

Here when the `apply_settings` function is invoked, the function then proceeds to the main logic block within a try-except structure It attempts to parse the incoming request as JSON with `await request.json()`, which is an asynchronous call that waits for the JSON data to be read from the request. Once the JSON data is retrieved, the function extracts a `config` dictionary from the `config_data`. The code then enters another try-except block where it iterates over the keys of the current server configuration, `lollmsElfServer.config.config.keys()`. For each key, it updates the server's configuration with the new values provided in the request, defaulting to the existing value if a new value is not provided.

Nevertheless, differs from its brother function `async def update_setting(request: Request):`; `apply_settings` didn't made any sort of sanitization on the parsed `json`, which furthermore these `json` will be further parsed into the globally-set configuration file. Allowing Fix RCEs still practical 

* https://huntr.com/bounties/e585f1dd-a026-4419-8f42-5835e85fad9e
* https://huntr.com/bounties/b2771df3-be50-45bd-93c4-0974ce38bc22
* https://huntr.com/bounties/65d0ef59-a761-4bbd-86fa-dd8e8621082e
* https://huntr.com/bounties/63266c77-408b-45ff-962c-8163db50a864

[]()