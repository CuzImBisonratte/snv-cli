# Actions List

All actions lie under the `https://SNVURL/snvmodules` URL.
Parameters are passed as query parameters.
Example Responses are provided for each action, with notes on what to expect.

## Responses

Every response, failing or successful, will report the HTTP status code `200 OK`.
In general most actions will return nothing in the body but will return the following headers:

```HTTP
method: METHOD-USED
lnname: SCHOOLNAME
lnstrasse: SCHOOLSTREET
lnplzort: SCHOOLZIPCODE SCHOOLCITY
```

other headers may be present depending on the action, see the specific action for more information.

# Check Session

This action is used to check if the session is still valid.
It can also be used to get the school name and other information.

```
/snvmodules?method=checksession&sessionid=SESSIONID
```

## Parameters

-   method: checksession
-   sessionid: Your session ID (optional)

## Response

```HTTP
method: checksession
resultcode: 100
resulttext: OK
command: showlogonpage
```

# Authentication

```
/snvmodules?method=auth&sessionid=&username=USERNAME&password=PASSWORD&validationcode=
```

## Parameters

-   method: auth
-   sessionid: none - We are not logged in yet
-   username: Your username
-   password: Your password
-   validationcode: none - We are not logged in yet

## Response

The response does not contain any body.
It contains the following headers:

```HTTP
resultcode: 100
resulttext: USERNAME authentifiziert priv=S
sessionid: 1DD10FDB04044C09AB7D0EEE018A619F
logontimestamp: 09.11.2024-17.45.49.247
```
