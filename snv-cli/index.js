// Modules
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const prompts = require("prompts");
const progressBar = require('progress');

// Create file if it doesn't exists
if (!fs.existsSync(path.join(__dirname, "config.json")))
    fs.writeFileSync(
        path.join(__dirname, "config.json"),
        JSON.stringify({ username: "", password: "", snvURL: "", backup_exclude: [] }, null, 4)
    );
var config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
const configfile = JSON.parse(JSON.stringify(config)); // Store raw config file for later comparison

// Set up persistent storages
var COOKIES = {
    SNVWebPortalSessionID: "",
    HASH_SNVWebPortalSessionID: ""
};
var SESSION_ID = "";
var SESSION_INFO = {
    schoolname: "",
    schoollocation: "",
    schoolstreet: ""
};

/* --------------------- */
/* - Helper  Functions - */
/* --------------------- */

// Show banner
function showBanner() {
    console.log("┌" + ("─".repeat(78)) + "┐");
    console.log("│" + (" ".repeat(78)) + "│");
    console.log("│" + (" ".repeat(32)) + "\x1b[33m\x1b[1mSNV CLI v0.1.2\x1b[0m" + (" ".repeat(32)) + "│");
    console.log("│" + (" ".repeat(78)) + "│");
    console.log("│" + (" ".repeat(14)) + "\x1b[31mSNV CLI is not affiliated with SchulNetzVerwalter.\x1b[0m" + (" ".repeat(14)) + "│");
    console.log("│" + (" ".repeat(17)) + "\x1b[31mThis is free software. Use at your own risk.\x1b[0m" + (" ".repeat(17)) + "│");
    console.log("│" + (" ".repeat(78)) + "│");
    console.log("└" + ("─".repeat(78)) + "┘");
    console.log("\n");
}

// User output
function userOutput(message, type = "info") {
    const icon = (() => {
        switch (type) {
            case "info":
                return "\x1b[36mℹ";
            case "success":
                return "\x1b[32m✔";
            case "warning":
                return "\x1b[33m⚠";
            case "error":
                return "\x1b[31m✖";
        }
    })();
    console.log(icon + "\x1b[0m " + message);
}

// HTML special characters to text
function htmlDecode(input) {
    return input.replace(/&amp;/g, '&').replace(/&szlig;/g, 'ß').replace(/&ouml;/g, 'ö').replace(/&auml;/g, 'ä').replace(/&uuml;/g, 'ü').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü');
}

// Fileurl encoder
function fileUrlEncode(str) {
    return str
        .replace(/ü/g, "*uuml;")
        .replace(/ö/g, "*ouml;")
        .replace(/ä/g, "*auml;")
        .replace(/Ü/g, "*Uuml;")
        .replace(/Ö/g, "*Ouml;")
        .replace(/Ä/g, "*Auml;")
        .replace(/ß/g, "*szlig;");
}

// Fileurl decoder
function fileUrlDecode(str) {
    return str
        .replace(/\*uuml;/g, "ü")
        .replace(/\*ouml;/g, "ö")
        .replace(/\*auml;/g, "ä")
        .replace(/\*Uuml;/g, "Ü")
        .replace(/\*Ouml;/g, "Ö")
        .replace(/\*Auml;/g, "Ä")
        .replace(/\*szlig;/g, "ß");
}

// Choose file
async function chooseFile() {
    var fileChosen = false;
    var currentPath = process.cwd();
    while (!fileChosen) {
        const files = fs.readdirSync(currentPath);
        const options = [{ title: "../", value: path.join(currentPath, "../") }];
        console.clear();
        showBanner();
        console.log("Current Path: " + currentPath + "\n");
        for (const file of files) {
            if (file.startsWith(".")) continue;
            if (!fs.existsSync(path.join(currentPath, file))) continue;
            const stats = fs.statSync(path.join(currentPath, file));
            options.push({ title: stats.isDirectory() ? file + "/" : file, value: path.join(currentPath, file) });
        }
        const response = await prompts({
            type: "select",
            name: "action",
            message: "Choose a file",
            initial: 1,
            choices: options
        });
        if (fs.statSync(response.action).isDirectory()) {
            currentPath = response.action;
        } else {
            return response.action;
        }
    }
}

async function createFolderStructure(tree, currentPath) {
    for (const key in tree) {
        if (typeof tree[key] == "object") {
            fs.mkdirSync(path.join(currentPath, key));
            await createFolderStructure(tree[key], path.join(currentPath, key));
        }
    }
}

function getFiles(tree) {
    var files = [];
    for (const key in tree) {
        if (typeof tree[key] == "object") {
            files.push(...getFiles(tree[key]));
        } else {
            files.push(tree[key]);
        }
    }
    for (const key in files) if (files[key].endsWith("/")) files.splice(key, 1);
    return files;
}


/* --------------------- */
/* - SNV-API Functions - */
/* --------------------- */

// Format cookie
function formatCookie() {
    var cookieString = "";
    for (var key in COOKIES) {
        cookieString += key + "=" + COOKIES[key] + ";";
    }
    return cookieString;
}

// Query the SNV Web Portal
async function querySNV(params, rawResponse = false) {
    const options = {
        method: 'GET',
        url: "https://" + config.snvURL + "/snvmodules",
        params: params,
        headers: { Cookie: formatCookie() }
    };
    try {
        const response = await axios.request(options);
        return rawResponse ? response : response.headers;
    } catch (error) {
        console.error(error);
    }
}

// Check if SNV Web Portal is reachable
async function checkSNV() {
    try {
        await axios.get("https://" + config.snvURL + "/snvmodules?method=checksession").then((response) => {
            if (response.headers.method && response.headers.method == 'checksession') return 1;
            return 0;
        });
    } catch (error) {
        return 0;
    }
}

// Download from SNV
async function downloadFromSNV(snvPath) {
    const options = {
        method: 'GET',
        url: "https://" + config.snvURL + snvPath,
        headers: { Cookie: formatCookie() },
        params: { sessionid: SESSION_ID },
        responseType: 'stream'
    };
    const response = await axios.request(options);
    const filename = snvPath.split("/").pop();
    const downloadPath = path.join(process.cwd(), filename);
    const writer = fs.createWriteStream(downloadPath);
    await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        let error = null;
        writer.on('error', err => {
            error = err;
            writer.close();
            reject(err);
        });
        writer.on('close', () => {
            if (!error) resolve();
        });
    });
    return downloadPath;
}

// Upload to SNV
async function uploadToSNV(file, snvPath) {
    const content = fs.readFileSync(file);
    const contentLength = content.length;
    const options = {
        method: 'PUT',
        url: "https://" + config.snvURL + snvPath.replace(/ /g, "%20"),
        headers: {
            'Cookie': formatCookie() + " uploadurl=/snvcloud/Home/Test/test2/; seqid=; uploadfilename=;",
            'Content-Length': contentLength,
            'Content-Type': 'application/octet-stream'
        },
        data: content
    };
    await axios.request(options);
}

async function queryDirTree(path = "/snvcloud/") {
    var tree = {};
    await querySNV({
        method: 'getdirectoryentry',
        sessionid: SESSION_ID,
        path: fileUrlEncode(path)
    }, true).then(async (data) => {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write("Currently processing directory: " + path);
        for (const entry of data.data.rows) {
            if (entry.url.endsWith("/") && !config.backup_exclude.includes(entry.name)) {
                subTree = await queryDirTree(entry.url);
                tree[entry.name] = subTree;
            } else {
                tree[entry.name] = entry.url;
            }
        }
    });
    // Wait 0.5 seconds (this is per directory depth, so it is not doing too much overhead)
    await new Promise(resolve => setTimeout(resolve, 250));
    return tree;
}

async function downloadBackupFiles(files, currentPath) {
    const bar = new progressBar('Downloading file :current/:total (:percent) [:bar] :etas remaining', { total: files.length });
    // Download files
    for (const file of files) {
        const downloadPath = await downloadFromSNV(file);
        fs.renameSync(downloadPath, path.join(currentPath, file.replace("/snvcloud", "")));
        bar.tick();
    }
    bar.terminate();
}

/* --------------------- */
/* -- Main  Functions -- */
/* --------------------- */

// promptURL
async function promptURL() {
    // Check if snvURL is already saved
    if (config.snvURL == "" || config.snvURL == undefined) {
        // Get snvURL
        await (async () => {
            const response = await prompts({
                type: "text",
                name: "snvURL",
                message: "Enter the URL of your school's SNV Web Portal"
            });
            // Cut off to base URL (remove protocol and trailing slash)
            response.snvURL = response.snvURL.replace(/(^\w+:|^)\/\//, "").replace(/\/$/, "");
            config.snvURL = response.snvURL;
        })();
    }
    // Check if URL is valid
    await checkSNV()
        .then(async (data) => {
            if (data == 0) {
                userOutput("SNV Web Portal is not reachable. Please check the URL.", "error");
                config.snvURL = "";
                await promptURL();
                return;
            } else {
                await querySNV({
                    method: 'checksession'
                }).then((data) => {
                    // Show school name
                    const [plz, ...ort] = data.lnplzort.split("-");
                    userOutput("School found: " + data.lnname + ", " + ort.join("-"), "success");
                    // Save school name
                    SESSION_INFO.schoolname = data.lnname;
                    SESSION_INFO.schoollocation = data.lnplzort;
                    SESSION_INFO.schoolstreet = htmlDecode(data.lnstrasse);
                });
            }
        });
}

// Login
async function login() {
    // Check if config.json contains credentials
    if (config.username == "" || config.password == "" || config.username == undefined || config.password == undefined) {
        console.log("\nPlease enter your SNV Web Portal credentials to log in.");
        // Ask for username
        await (async () => {
            const response = await prompts({
                type: "text",
                name: "username",
                message: "Username"
            });
            config.username = response.username;
        })();
        // Ask for password
        await (async () => {
            const response = await prompts({
                type: "password",
                name: "password",
                message: "Password"
            });
            config.password = response.password;
        })();
    }
    // Login
    await querySNV({
        method: 'auth',
        username: config.username,
        password: config.password
    }).then(async (data) => {
        // Check if login was successful
        if (data.resultcode == -1) {
            userOutput("Login failed. Please check your credentials.", "error");
            config.username = "";
            config.password = "";
            await login();
            return;
        }
        SESSION_ID = data.sessionid;
        var cookieString = data["set-cookie"];
        cookieString.forEach((element) => {
            if (element.includes("HASH_SNVWebPortalSessionID")) COOKIES.HASH_SNVWebPortalSessionID = element.split(";")[0].split("=")[1];
            else if (element.includes("SNVWebPortalSessionID")) COOKIES.SNVWebPortalSessionID = element.split(";")[0].split("=")[1];
        });
        userOutput("Logged in as: " + config.username, "success");
    });
    // Check if user credentials are already saved
    if (JSON.stringify(configfile) != JSON.stringify(config)) {
        await (async () => {
            const response = await prompts({
                type: "confirm",
                name: "save",
                message: "Do you want to save these credentials for future use?"
            });
            if (response.save) {
                fs.writeFileSync(path.join(__dirname, "config.json"), JSON.stringify(config, null, 4));
                userOutput("Credentials saved successfully.", "success");
            }
        })();
    }
}

// Logout
async function logout() {
    await querySNV({
        method: 'logout',
        sessionid: SESSION_ID
    }).then((data) => {
        if (data.resultcode == 100) userOutput("Logged out successfully.", "success");
        else userOutput("Logout failed. Forcing program to end without closing the session!", "error");
    });
    userOutput("Thank you for using SNV CLI. Goodbye!", "info");
}

// Show more information
async function showInfo() {
    await querySNV({
        method: 'customstoredproc',
        sessionid: SESSION_ID,
        procname: 'sp_webservices_GetRoomAllocationInfo'
    }).then((data) => {
        for (var key in data) { data[key] = htmlDecode(data[key]); }
        console.log("\n");
        if (data.schule) userOutput("School Custom Name: " + data.schule);
        userOutput("School Name: " + SESSION_INFO.schoolname);
        userOutput("School Location: " + SESSION_INFO.schoollocation);
        userOutput("School Street: " + SESSION_INFO.schoolstreet);
        if (data.room) userOutput("The room you are in: " + data.room);
        if (data.wsid) userOutput("You are working from Workspace: " + data.wsid);
        if (data.groupassignedtoroom) userOutput("Group assigned to your room: " + data.groupassignedtoroom);
        if (data.account) userOutput("Your account: " + data.account);
        if (data.isteacher) userOutput("Are you a teacher: " + data.isteacher);
        if (data.internalip) userOutput("Are you using an internal IP: " + data.internalip);
        console.log("\n");
    });
}

// Filemanager
async function filemanager() {
    currentpath = "/snvcloud/";
    // Loop
    while (true) {
        // Get user input
        console.log("Current Path: " + fileUrlDecode(currentpath).replace("/snvcloud", "") + "\n");
        // Get current directory
        dirEntries = [];
        await querySNV({
            method: 'getdirectoryentry',
            sessionid: SESSION_ID,
            path: currentpath
        }, true).then((data) => { dirEntries = data.data.rows; });
        // Format options
        options = [];
        if (currentpath != "/snvcloud/") options.push({ title: "../", value: path.join(currentpath, "../") });
        for (const entry of dirEntries) options.push({ title: entry.type ? entry.name : entry.name + "/", value: fileUrlEncode(entry.url) });
        options[options.length - 1].title = options[options.length - 1].title + "\n";
        const response = await prompts({
            type: "select",
            name: "action",
            message: "",
            choices: [...options, { title: "More options", value: "actions" }, { title: "Exit File Manager", value: "back" }]
        });
        if (response.action == "actions") {
            if (currentpath == "/snvcloud/") {
                console.clear();
                showBanner();
                userOutput("You cannot perform actions on the root directory.\n", "warning");
                continue;
            }
            const actionResponse = await prompts({
                type: "select",
                name: "action",
                message: "What do you want to do?",
                choices: [
                    { title: "Rename/Move", value: "rename" },
                    { title: "Delete", value: "delete" },
                    { title: "Upload file", value: "upload" },
                    { title: "New Folder\n", value: "folder" },
                    { title: "Exit", value: "exit" }
                ]
            });
            switch (actionResponse.action) {
                case "rename":
                    const renameResponse = await prompts({
                        type: "text",
                        name: "action",
                        message: "Enter the FULL new name/path of the folder",
                        validate: value => value.startsWith("/") ? true : "Path must start with '/'"
                    });
                    var oldpath = fileUrlEncode(currentpath);
                    var newpath = "/snvcloud" + renameResponse.action.replace("/snvcloud", "");
                    console.clear();
                    showBanner();
                    await querySNV({
                        method: 'move',
                        sessionid: SESSION_ID,
                        path: oldpath,
                        newpath: newpath
                    }).then((data) => {
                        if (data.commandresponseno.startsWith("2")) userOutput("Folder renamed/moved successfully.\n", "success");
                        else userOutput("Folder rename/move failed.", "error");
                    });
                    currentpath = fileUrlEncode(newpath);
                    console.log("");
                    continue;
                case "delete":
                    const deleteResponse = await prompts({
                        type: "confirm",
                        name: "action",
                        message: "Are you sure you want to delete this folder?"
                    });
                    if (deleteResponse.action) {
                        console.clear();
                        showBanner();
                        await querySNV({
                            method: 'delete',
                            sessionid: SESSION_ID,
                            path: fileUrlEncode(currentpath)
                        }).then((data) => {
                            if (data.commandresponseno.startsWith("2")) userOutput("Folder deleted successfully.\n", "success");
                            else userOutput("Folder deletion failed.", "error");
                        });
                        currentpath = path.join(currentpath, "../");
                    }
                    continue;
                case "upload":
                    var localFile = await chooseFile();
                    var uploadPath = currentpath + path.basename(localFile);
                    await uploadToSNV(localFile, uploadPath);
                    console.clear();
                    showBanner();
                    userOutput("File uploaded successfully.", "success");
                    continue;
                case "folder":
                    const folderResponse = await prompts({
                        type: "text",
                        name: "action",
                        message: "Enter the name of the new folder",
                        validate: value => /^[^<>:"/\\|?*\x00-\x1F]+$/.test(value) ? true : "Invalid folder name"
                    });
                    var folder_path = currentpath + fileUrlEncode(folderResponse.action);
                    console.clear();
                    showBanner();
                    await querySNV({
                        method: 'mkcol',
                        sessionid: SESSION_ID,
                        path: folder_path
                    }).then((data) => {
                        if (data.commandresponseno.startsWith("2")) userOutput("Folder created successfully.\n", "success");
                        else userOutput("Folder creation failed.", "error");
                    });
                    continue;
                case "exit":
                    console.clear();
                    showBanner();
                    continue;

            }
            continue;
        }
        console.clear();
        showBanner();
        if (response.action == "back") {
            return;
        };
        if (response.action.endsWith("/")) {
            currentpath = response.action;
            continue;
        }
        console.log("Current File: " + fileUrlDecode(response.action).replace("/snvcloud", "") + "\n");
        // Handle file menu
        const actionResponse = await prompts({
            type: "select",
            name: "action",
            message: "What do you want to do?",
            choices: [
                { title: "Download", value: "download" },
                { title: "Rename/Move", value: "rename" },
                { title: "Delete\n", value: "delete" },
                { title: "Exit", value: "exit" }
            ]
        });
        console.clear();
        showBanner();
        switch (actionResponse.action) {
            case "download":
                var dl_path = await downloadFromSNV(response.action);
                userOutput("File downloaded successfully to \x1b[36m" + dl_path + "\x1b[0m\n", "success");
                break;
            case "rename":
                console.log("Current Path: " + fileUrlDecode(response.action).replace("/snvcloud", "") + "\n");
                const renameResponse = await prompts({
                    type: "text",
                    name: "action",
                    message: "Enter the FULL new name/path of the file",
                    validate: value => value.startsWith("/") ? true : "Path must start with '/'"
                });
                var oldpath = fileUrlEncode(response.action);
                var newpath = "/snvcloud" + renameResponse.action.replace("/snvcloud", "");
                console.clear();
                showBanner();
                await querySNV({
                    method: 'move',
                    sessionid: SESSION_ID,
                    path: oldpath,
                    newpath: newpath
                }).then((data) => {
                    if (data.commandresponseno.startsWith("2")) userOutput("File renamed/moved successfully.\n", "success");
                    else userOutput("File rename/move failed.", "error");
                });
                break;
            case "delete":
                console.log("Current Path: " + fileUrlDecode(response.action).replace("/snvcloud", "") + "\n");
                const deleteResponse = await prompts({
                    type: "confirm",
                    name: "action",
                    message: "Are you sure you want to delete this file?"
                });
                console.clear();
                showBanner();
                if (deleteResponse.action) {
                    await querySNV({
                        method: 'delete',
                        sessionid: SESSION_ID,
                        path: fileUrlEncode(response.action)
                    }).then((data) => {
                        if (data.commandresponseno.startsWith("2")) userOutput("File deleted successfully.\n", "success");
                        else userOutput("File deletion failed.", "error");
                    });
                }
        }
    }
}

// Backup
async function backup() {
    userOutput("This feature, as it is right now, can't be used for restoring files. It should only be used for downloading all your files to a local directory.\n", "warning");
    const backupPathQ = await prompts({
        type: "text",
        name: "action",
        message: "Enter the path where you want to save the backup. A folder for it will be created.",
        initial: process.cwd(),
        validate: value => fs.existsSync(value) ? true : "Path does not exist"
    });
    let backupPath = path.join(backupPathQ.action + "/", "SNV-Backup_" + config.username + "_" + new Date().toISOString().split("T")[0]);
    console.clear();
    showBanner();
    if (fs.existsSync(backupPath)) { // Check if path exists, if so abort
        userOutput("Path already exists. Aborting backup.", "error");
        userOutput("If you want to create a new backup, please delete " + backupPath + "!\n", "info");
        userOutput("Tip: I do recommend, not to use this method repeatedly, as it is resource intensive for both, the SNV-Server as well as your device.", "info");
        return;
    }
    userOutput("Creating backup at " + backupPath + "\n", "info");
    // Check if path exists
    const response = await prompts({
        type: "confirm",
        name: "action",
        message: "Are you sure you want to create a backup of all your files to this location?"
    });
    if (!response.action) return;
    fs.mkdirSync(backupPath); // Create backup folder    
    console.clear();
    showBanner();
    userOutput("Backup started. Please wait, this may take a while.\n", "info");
    const DL_dirs = await queryDirTree(); // Get all directories
    await createFolderStructure(DL_dirs, backupPath); // Create folder structure
    const DL_files = getFiles(DL_dirs); // Get all files
    console.clear();
    showBanner();
    userOutput("Downloading files, please wait...\n", "info");
    userOutput("The download may seem still sometimes, don't worry, just wait.\n", "info");
    await downloadBackupFiles(DL_files, backupPath); // Download all files
    console.clear();
    showBanner();
    userOutput("Backup completed successfully.\n", "success");
}

// Main function
async function main() {
    // This is needed to catch CTRL+C (see https://github.com/terkelg/prompts/issues/252#issuecomment-2424555811)
    process.stdin.on("keypress", function (_chunk, key) {
        if (key && key.name === "c" && key.ctrl) {
            process.stdout.write("\x1B[?25h\n");
            console.clear();
            showBanner();
            userOutput("Exiting on user request.", "info");
            process.exit(130);
        }
    });
    console.clear();
    showBanner();
    await promptURL();
    await login();
    // Main loop
    while (true) {
        // Get user input
        console.log("");
        const response = await prompts({
            type: "select",
            name: "action",
            message: "What do you want to do?",
            choices: [
                { title: "Show File Manager", value: "filemanager" },
                { title: "Create a backup", value: "backup" },
                { title: "Show More Information", value: "info" },
                { title: "Exit", value: "exit" }
            ]
        });
        console.clear();
        showBanner();
        switch (response.action) {
            case "filemanager":
                await filemanager(); // Filemanager is such a big feature that it has its own function 
                break;
            case "backup":
                await backup();
                break;
            case "info":
                await showInfo();
                break;
            case "exit":
                await logout();
                process.exit(0);
        }
    }
}
main();
