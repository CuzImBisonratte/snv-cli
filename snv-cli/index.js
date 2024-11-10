// Modules
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const prompts = require("prompts");
var config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));

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
    console.log("│" + (" ".repeat(32)) + "\x1b[33m\x1b[1mSNV CLI v0.1.0\x1b[0m" + (" ".repeat(32)) + "│");
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
            const actionResponse = await prompts({
                type: "select",
                name: "action",
                message: "What do you want to do?",
                choices: [
                    { title: "Rename/Move", value: "rename" },
                    { title: "Delete", value: "delete" },
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
                        if (data.commandresponseno.startsWith("2")) userOutput("Folder renamed/moved successfully.", "success");
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
                            if (data.commandresponseno.startsWith("2")) userOutput("Folder deleted successfully.", "success");
                            else userOutput("Folder deletion failed.", "error");
                        });
                        currentpath = path.join(currentpath, "../");
                    }
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
                        if (data.commandresponseno.startsWith("2")) userOutput("Folder created successfully.", "success");
                        else userOutput("Folder creation failed.", "error");
                    });
                    continue;
            }
            continue;
        }
        console.clear();
        showBanner();
        if (response.action == "back") {
            break;
        };
        if (response.action.endsWith("/")) {
            currentpath = response.action;
            continue;
        }
    }
}
// Main function
async function main() {
    // This is needed to catch CTRL+C (see https://github.com/terkelg/prompts/issues/252#issuecomment-2424555811)
    process.stdin.on("keypress", function (_chunk, key) {
        if (key && key.name === "c" && key.ctrl) {
            process.stdout.write("\x1B[?25h\n");
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
