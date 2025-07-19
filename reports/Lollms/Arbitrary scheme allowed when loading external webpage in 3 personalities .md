# Description
`Lollms` allow users to utilize build-in personalities *(Prompted LLM agent)* to finish certain task with extra ability. However, build-in personality `askinternet`,`gpt4Internet` and `internet_scraper`contains flaw that allows attacker to use arbitrary scheme/protocol when fetch external resources via `driver.get`. This is exploitable at a high extent since it allowed protocol like `file://` and etc. Which `file://` allows user to fetch arbitrary local resources on the file system. 

 # Proof of Concept
Similar flaw of design occur in the `internet` category within the build-in personalities: `lollms-webui/zoos/personalities_zoo/internet`

## `./lollms-webui/zoos/personalities_zoo/internet/askinternet` 

`scripts/processor.py` :

```
```



