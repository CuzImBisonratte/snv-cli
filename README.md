<a href="https://gitmoji.dev">
  <img
    src="https://img.shields.io/badge/Commits%20use%20gitmoji-%20😜%20😍-FFDD67.svg?style=for-the-badge"
    alt="Gitmoji"
  />
</a>

# SNV-cli

This repository contains a collection of resources I wrote whilst reverse engineering the SNV-WebPortal, a web application used by many german schools to manage student data.

The applications main use is to provide students with access to the data on the school systems from home.

The use of this repository is to provide a easy to use reference for developers who want to interact with SNV web applications and for myself to write a cli wrapper for it.

```diff
- I am not affiliated with SNV.
- Use the information from this repository at your own risk.
```

## Table of Contents

-   actions.md: A list of all actions i reverse engineered from the web application.
-   README.md: This file.

In the snv-cli folder you will find a nodejs wrapper for the web application I wrote to check wheter the actions I reverse engineered are correct and to provide a easier way to interact with the web application.

# Installation

Put the snv-cli folder anywhere on your system and run `npm install` in the folder.  
Add a `config.json` file to the folder with the following content:

```json
{
	"snvURL": "",
	"username": "",
	"password": "",
	"backup_exclude": [".git", ".node_modules", ""]
}
```

Replace the values with your own credentials if you want to store them.

The `backup_exclude` array is used to exclude files from the backup command. Its used to exclude big folders with many files that are not needed for backups, but would slow down and result in many requests to the server.

# Usage

To use the cli run `node index.js` in the snv-cli folder.

## Bash-Alias

To make the cli easier to start you can add the following aliases to your .bash_aliases (Tested on Ubuntu 22+):

```bash
alias snv="node /path/to/snv-cli/index.js"
```
