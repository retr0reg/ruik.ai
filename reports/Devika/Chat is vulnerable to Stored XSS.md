# Description
`Devika`'s Core Chat feature is vulnerable to Stored XSS Injections. Despite sanitization is taken on injected codes. Nevertheless, JavaScript payload can still be injected via specific payload and perform Stored XSS Injections.

 # Proof of Concept
1. Go to `Devika UI` .

2. Open Arbitrary Project with Arbitrary Models.

3. Submit message: 

   ```html
   <iframe><img title="</iframe><img src onerror=alert(1)>"></iframe>
   ```

4. `alert(1)` box will pop out indicating injection of `Javascript Code`

   ![image-20240412071408304](https://raw.githubusercontent.com/retr0reg/0reg-uploads/main/img/202404120714347.png)

