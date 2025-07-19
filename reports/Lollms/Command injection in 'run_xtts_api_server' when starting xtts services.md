# Description
`./lollms-webui/lollms_core/lollms/services/xtts/lollms_xtts.py` -> `run_xtts_api_server` allow user to start the `xtts` server via `xtts` in installed `miniconda3` for `run_python_script_in_env("xtts",f"-m xtts_api_server -o  {self.output_folder} -sf {self.voice_samples_path} -p {self.xtts_base_url.split(':')[-1].replace('/','')}"`. However, the function used ` subprocess.Popen` to execute a command build using python `f-string`. However, since `xtts_base_url` can be modified in the setting without concerning the `xtts_base_url`. Attackers can construct a payload that allowed RCE based on the specified process of the command.

 # Source To Sink

Whenever the the server initialize`xtts_servers` whether when starting the server or calling the server, the server will went though `./lollms-webui/lollms_core/lollms/services/xtts/lollms_xtts.py` -> `LollmsXTTS`

```python
class LollmsXTTS:
    has_controlnet = False
    def __init__(
                    self, 
                    app:LollmsApplication, 
                    xtts_base_url=None,
                    share=False,
                    max_retries=10,
                    voice_samples_path="",
                    wait_for_service=True
                    ):
        if xtts_base_url=="" or xtts_base_url=="http://127.0.0.1:8020":
            xtts_base_url = None
        # Get the current directory
        lollms_paths = app.lollms_paths
        self.app = app
        root_dir = lollms_paths.personal_path
        self.voice_samples_path = voice_samples_path
        
        # Store the path to the script
        if xtts_base_url is None:
            self.xtts_base_url = "http://127.0.0.1:8020"
            if not verify_xtts(lollms_paths):
                install_xtts(app.lollms_paths)
        else:
            self.xtts_base_url = xtts_base_url

        self.auto_xtts_url = self.xtts_base_url+"/sdapi/v1"
        shared_folder = root_dir/"shared"
        self.xtts_folder = shared_folder / "xtts"

        ASCIIColors.red("   __    ___  __    __          __     __  ___   _        ")
        ASCIIColors.red("  / /   /___\/ /   / /   /\/\  / _\    \ \/ / |_| |_ ___  ")
        ASCIIColors.red(" / /   //  // /   / /   /    \ \ \ _____\  /| __| __/ __| ")
        ASCIIColors.red("/ /___/ \_// /___/ /___/ /\/\ \_\ \_____/  \| |_| |_\__ \ ")
        ASCIIColors.red("\____/\___/\____/\____/\/    \/\__/    /_/\_\\__|\__|___/ ")
                                                         
        ASCIIColors.red(" Forked from daswer123's XTTS server")
        ASCIIColors.red(" Integration in lollms by ParisNeo using daswer123's webapi")
        ASCIIColors.red(" Address :",end="")
        ASCIIColors.yellow(f"{self.xtts_base_url}")

        self.output_folder = app.lollms_paths.personal_outputs_path/"audio_out"
        self.output_folder.mkdir(parents=True, exist_ok=True)

        if not self.wait_for_service(1,False):
            ASCIIColors.info("Loading lollms_xtts")
            # Launch the Flask service using the appropriate script for the platform
            self.process = self.run_xtts_api_server()

        # Wait until the service is available at http://127.0.0.1:7860/
        if wait_for_service:
            self.wait_for_service(max_retries=max_retries)
```

This `__init__` method basically sets up the necessary configuration and environment for the `LollmsXTTS` class to interact with a text-to-speech (TTS) server. It initializes the base URL for the TTS service, ensures that the required directories and paths are in place, and attempts to launch the TTS service if it is not already running. Additionally, it waits for the service to become available if the `wait_for_service` flag is set to `True`.

However, as we can see here, whenever the server enters ` if not self.wait_for_service(1,False):`*(usually when initializing the `XTTS` server)*, it will call `self.run_xtts_api_server()` to start our `XTTS` server:

## `run_xtts_api_server`

```python
    def run_xtts_api_server(self):
        # Get the path to the current Python interpreter
        python_path = sys.executable
        ASCIIColors.yellow("Loading XTTS ")
        process = run_python_script_in_env("xtts",f"-m xtts_api_server -o  {self.output_folder} -sf {self.voice_samples_path} -p {self.xtts_base_url.split(':')[-1].replace('/','')}", wait= False)
        return process
```

In `run_xtts_api_server`, It starts by getting the path to the current Python interpreter using `sys.executable`. This is necessary because the method needs to run a Python script, and it must ensure that it uses the same Python environment that the current application is running in. *(Which is not implemented for some reason)*, Furthermore, it called `run_python_script_in_env`:

```python
def run_python_script_in_env(env_name, script_path, cwd=None, wait=True):
    from conda.cli.python_api import  run_command, Commands
    import platform
    # Set the current working directory if provided, otherwise use the current directory
    if cwd is None:
        cwd = os.getcwd()
    
    # Activate the Conda environment
    python_path = Path(sys.executable).parent.parent/"miniconda3"/"envs"/env_name/"python"
    process = subprocess.Popen(f'{python_path} {script_path}', shell=True)
    
    # Wait for the process to finish
    if wait:
        process.wait()
    #subprocess.Popen(f'conda activate {env_name} && {script_path}', shell=True, cwd=cwd)
    #run_command(Commands.RUN, "-n", env_name, "python " + str(script_path), cwd=cwd)
    return process
```

As we can see in `run_python_script_in_env`, it runs the `env_name` and `script_path` directly via Python f-string, this is dangerous since it does not sanitize the inputs and parse `args` for in a secure way, potentially allowing for command injection if `env_name` or `script_path` contain malicious code. The use of `shell=True` in `subprocess.Popen` can be a security hazard when combined with unsanitized input, as it allows for shell command execution.

## Exploiting

From previous analysis, we can conclude that `run_xtts_api_server` is vulnerable to `Remote Code Execution` since it parse untrusted argument `self.xtts_base_url.split`, that can be set despite the `Path traversal`sanitzation of `sanitize_path()` implemented in save-configuration related endpoint. To properly execute our command with the `{self.xtts_base_url.split(':')[-1].replace('/','')}`, a practical payload will be 

```python
	  <Proper Server IP>:`<ARBITRARY COMMAND>` or <Proper Server IP>:$(<ARBITRARY COMMAND>)
```

From Source-To-Sink, we found that `LollmsXTTS` will be called in 

* Starting `app.py`.
* Via endpoints:
  *  `@router.post("/text2Audio")`
  * `@router.get("/start_xtts")`
* Via `lollms_webui`
  * `rebuild_personalities`
  * `start_message_generation` when `self.config.enable_voice_service and self.config.auto_read and len(self.personality.audio_samples)>0`

After properly change of config in various available endpoints *(such as `/apply_settings`. `/update_setting` etc); RCE will be triggered with arbitrary trigger of these events.