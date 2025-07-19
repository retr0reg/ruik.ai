# Description
In `collector/utils/url/index.js`, function `isInvalidIp` checks and check if the `destination` is vulnerable to `SSRFs`. However, due to the fact it only perform checks on the URL it self, instead of the `dns` it is pointing to, the attacker may construct a domain pointing to a internal address, causing SSRF.

# Vulnerability

`collector/utils/url/index.js`

```js
const VALID_PROTOCOLS = ["https:", "http:"];
const INVALID_OCTETS = [192, 172, 10, 127];

function isInvalidIp({ hostname }) {
  const IPRegex = new RegExp(
    /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi
  );
  if (!IPRegex.test(hostname)) return false;
  const [octetOne, ..._rest] = hostname.split(".");

  // If fails to validate to number - abort and return as invalid.
  if (isNaN(Number(octetOne))) return true;
  return INVALID_OCTETS.includes(Number(octetOne));
}

function validURL(url) {
  try {
    const destination = new URL(url);
    if (!VALID_PROTOCOLS.includes(destination.protocol)) return false;
    if (isInvalidIp(destination)) return false;
    return true;
  } catch {}
  return false;
}

module.exports = {
  validURL,
};
```
The provided code is designed to validate a URL based on specific criteria:

1: **Protocol Check**: It ensures that the URL uses a valid protocol, either `https:` or `http:`. This is done by checking against the `VALID_PROTOCOLS` array, which defines the list of protocols considered valid.

2: **IP Address Validation**: Next, if the hostname part of the URL is an IP address, it checks whether this IP address is valid. This validation is done in two steps:

It uses a regular expression `IPRegex` to match the format of a standard IPv4 address. If the hostname does not match the IPv4 format, the `isInvalidIp` function returns `false`, indicating that the URL is considered valid since it might be using a domain name instead of an IP address. If the hostname matches the IPv4 format, it further checks whether the first octet of the IP address falls into certain values (defined in the `INVALID_OCTETS` array as 192, 172, 10, 127), which are typically used for private networks or special purposes, thus considered invalid.

Regarding handling **domain names**:

- **Domain Names**: If the input URL uses a domain name instead of an IP address, when executing the `isInvalidIp` function, the regular expression `IPRegex` will not succeed because the format of a domain name differs from that of an IPv4 address. Therefore, `isInvalidIp` will return `false` right from the start, indicating that, from the perspective of IP address validation, the URL is valid.

Subsequently, as long as the URL's protocol is valid (i.e., listed in the `VALID_PROTOCOLS` array), the URL is considered valid, since the code does not delve into further validation of the domain name itself or its resolution. Essentially, the code focuses on validating the protocol and preventing the use of certain specific IP addresses, without engaging in more complex validation processes like domain name resolution

# Proof of Concept

Thus, if the domain is pointing to address such as `127.0.0.1` , it will bypass the `collector/utils/url/index.js` creating `SSRF`

```python
import requests

burp0_url = "http://localhost:3001/api/workspace/0reg/upload-link"
burp0_json= {
    "link": "http://123.com"
}
requests.post(burp0_url, headers=burp0_headers, json=burp0_json)
```



