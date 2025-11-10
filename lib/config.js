import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createSpinner } from "nanospinner";
import * as toml from "@iarna/toml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ts loads the site info
export function loadSiteInfo() {
    const spin = createSpinner('loading source...').start();
    try {
        // looks for sites.json in the same folder as install
        const configPath = path.join(__dirname, '../sites.json');

        if (!fs.existsSync(configPath)) {
            throw new Error('sites.json not found');
        }

        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        spin.success({ text: 'source loaded successfully!' });
        return data;

    } catch (error) {
        spin.error({ text: `invalid site info: ${error.message}` });
        process.exit(1);
    }
}

// load user keys from ~/.config/sbfetch/keys.toml if the user is linux or c:\users\<username>\appdata\roaming\sbfetch\config.toml
export function loadUserKeys(site) {
    let configDir;

    if (process.platform === "win32") {
        configDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "sbfetch");
    } else {
        configDir = path.join(os.homedir(), ".config", "sbfetch");
    }

    const keyPath = path.join(configDir, "keys.toml");

    if (!fs.existsSync(keyPath)) {
        return {}; // no keys found
        if (log) {console.log('no keys found')}
    }

    try {
        const content = fs.readFileSync(keyPath, "utf8");
        const parsed = toml.parse(content);

        // returns site
        return parsed[site] || {};
    } catch (err) {
        console.error(`error parsing keys.toml: ${err.message}`);
        return {};
    }
}