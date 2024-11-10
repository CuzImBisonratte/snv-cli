# Actions List

All actions lie under the `https://SNVURL/snvmodules` URL.

The only "actions" not laying under this URL are file up- and downloads, which are described in the [File Actions](fileactions.md) document.

Parameters are passed as query parameters.
Example Responses are provided for each action, with notes on what to expect.

## Responses

Every response, failing or successful, will report the HTTP status code `200 OK`.
In general most actions will return nothing in the body (except for `getdirectoryentry`) but will return the following headers:

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

# CustomStoredProc

This action is used to call many different stored procedures.

```
/snvmodules?method=customstoredproc&sessionid=SESSIONID&needtrans=0&procname=PROCEDURENAME
```

### Parameters

-   method: customstoredproc
-   sessionid: Your session ID
-   needtrans: Don't know what this does, as it doesn't seem to change the response
-   procname: Name of the stored procedure to call

I found the following stored procedures:

## sp_webservices_GetRoomAllocationInfo

This stored procedure is used to get all kinds of information about the current room allocation AND user information.

### Response Headers

```HTTP
Schule: LLS
Room: WEBPORTAL
WsID: WP005
GroupAssignedToRoom: Keine Klasse/Gruppe f&uuml;r diesen Raum ausgew&auml;hlt
Account: user
LogonInfoText: Als Sch&uuml;ler angemeldet
apn: 0
activated: 0
roomInternetStatus: 0
pageSelectLocation: 0
pageFolders: 1
pageLocation: 0
pageSelectedClass: 0
pageInternetFilter: 0
octogateoptions: 0
tfkoptions: 0
CurrentLocationText: Raum "WEBPORTAL"
internalIP: 0
isTeacher: 0
wlancontrol: 0
```

Interesting fields are:

-   WsID: The ID of the Workstation currently logged in (Starts with WP for WebPortal)
-   Account: The username of the currently logged in user
-   page\* fields: These fields are likely used to determine which pages are available to the user
-   CurrentLocationText: The name of the room the user is currently in
-   isTeacher: Whether the user is a teacher or not

# DirectoryEntry

This action is used to get information about a file directory

```
/snvmodules?method=getdirectoryentry&sessionid=SESSIONID&path=%2Fsnvcloud%2F&sortoption=
```

### Parameters

-   method: getdirectoryentry
-   sessionid: Your session ID
-   path: The path to the directory you want to get information about (URL encoded - Root is /snvcloud/ (can also be / but default is /snvcloud/))
-   sortoption: If left empty, the response will be sorted by name ascending. Other options I found are:
    -   `dd` - Sort by date descending
    -   `da` - Sort by date ascending

### Response

The response contains a JSON object with the following structure:

```JSON
{
	"rows": [
		{
			"name": "Home",
			"url": "/snvcloud/Home/",
			"icon": "folder",
			"type": 0,
			"lastmodified": "",
			"size": ""
		},
		{
			"name": "Tausch",
			"url": "/snvcloud/Tausch/",
			"icon": "folder",
			"type": 0,
			"lastmodified": "",
			"size": ""
		}
	]
}

```
