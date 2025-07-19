# SSRF add_webpage() when fetching weblink for discussions via scrape_and_save()

# Description
The `add_webpage()` function in the `./events/lollms_chatbox_events.py` file of the application contains a Server-Side Request Forgery (SSRF) vulnerability. This function is designed to fetch and save the content of a webpage specified by a user through a chatbox feature, using a `scrape_and_save()` method. The vulnerability stems from the lack of proper input validation and sanitization on the user-supplied URL, which is passed directly to the `requests.get()` function.

The `scrape_and_save()` method, as defined, performs a basic HTTP GET request on the provided URL, processes the response to extract text content using BeautifulSoup, and saves this content to a text file without checking if the URL points to an internal or external resource. This approach allows attackers to specify arbitrary web links, including those pointing to internal services, thereby enabling the SSRF attack vector.

 # Proof of Concept

## Sink

In `./events/lollms_chatbox_events.py` : `add_webpage()`

```python
@sio.on('add_webpage')
    def add_webpage(sid, data):
        ASCIIColors.yellow("Scaping web page")
        client = lollmsElfServer.session.get_client(sid)
        url = data['url']
        index =  find_first_available_file_index(lollmsElfServer.lollms_paths.personal_uploads_path,"web_",".txt")
        file_path=lollmsElfServer.lollms_paths.personal_uploads_path/f"web_{index}.txt"
        lollmsElfServer.scrape_and_save(url=url, file_path=file_path)
        try:
            if not lollmsElfServer.personality.processor is None:
                lollmsElfServer.personality.processor.add_file(file_path, client, partial(lollmsElfServer.process_chunk, client_id = sid))
                # File saved successfully
                run_async(partial(sio.emit,'web_page_added', {'status':True,}))
            else:
                lollmsElfServer.personality.add_file(file_path, partial(lollmsElfServer.process_chunk, client_id = sid))
                # File saved successfully
                run_async(partial(sio.emit,'web_page_added', {'status':True}))
        except Exception as e:
            # Error occurred while saving the file
            run_async(partial(sio.emit,'web_page_added', {'status':False}))
            
```

`add_webpage(sid, data)` called `lollmsElfServer.scrape_and_save()` to save crawled webpage result

```python
   
    def scrape_and_save(self, url, file_path):
        # Send a GET request to the URL
        response = requests.get(url)
        
        # Parse the HTML content using BeautifulSoup
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find all the text content in the webpage
        text_content = soup.get_text()
        
        # Remove extra returns and spaces
        text_content = ' '.join(text_content.split())
        
        # Save the text content as a text file
        with open(file_path, 'w', encoding="utf-8") as file:
            file.write(text_content)
        
        self.info(f"Webpage content saved to {file_path}")

```

No sanitization in neither `scrape_and_save()` nor `add_webpage()` 

## Source

In http://localhost:9600/, attackers can add **arbitrary weblink** (http protocol) in to discussion (or a chat session) via `Upload a weblink to the discussion button` for assuming RAG jobs.

## xxxxxxxxxx ▲ ~ lsCodeLlaMa     MLs   hacked-by-retr0reg  vulnsDownloads     Pwns  oai-chatgptGit-Projects  SDR   pocshell

Firstly, attacker need to create a `discussion` , then use `Upload a weblink to the discussion button` to upload a URL, in this case, I am creating a simulating `Flask` app using this script:

```python
from flask import Flask

app = Flask(__name__)

# HOST http://127.0.0.1:5000/index.html
@app.route('/index.html')
def index():
    return '<flag>INTERNAL SERVICE flag={retr0reg}<flag>'

if __name__ == '__main__':
    app.run()
```

After adding `http://127.0.0.1:5000/index.html` in to the discussion. You will need to create a discussion with the same personality. After that, You will see a notification saying: `Webpage content saved to /home/retr0/Downloads/personal_data/uploads/web_4.txt`, and a `web_{INDEX}.txt` file in the left side of the discussion, which contains the information of targeted `http://127.0.0.1:5000/index.html`



