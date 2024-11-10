# Fileactions

Fileactions in this context refers only to up- and downloading files as these are the only two actions that cant be performed using `/snvmodules`.

## Downloading a file

Downloading a file is as easy as sending a GET request to the file you want to download and append the sessionid as a query parameter.  
For example, if you want to download a file called `example.txt` in the homedirectory of your logged in user:example.txt`.

```
https://SNVURL/snvcloud/Home/example.txt?sessionid=SESSIONID
```

## Uploading a file

Uploading a file is far more complicated than downloading one.

The first problem here is that SNV uses a custom chunked upload system for files larger than 1MB.  
I have not yet figured out how to upload files larger than 1MB using this system, so for now I will only cover uploading files smaller than 1MB.

### Small file upload (<= 1MB)

To upload a file smaller than 1MB, you send a PUT request to the file you want to upload.

```
https://SNVURL/snvcloud/Home/example.txt
```

The file content is sent as the body of the request.  
Also two headers are REQUIRED:

-   'Content-Length': The length of the file in bytes
-   'Content-Type': 'application/octet-stream' (Why exactly this cant be the MIME type of the file is beyond me)
