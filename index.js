#!/usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import fetch from 'node-fetch';
import fs from 'fs';
import { Command } from 'commander';
import path from 'path';
import cliProgress from "cli-progress";
import { loadSiteInfo, loadUserKeys } from './lib/config.js';


// ts sets up command
const program = new Command();
program
    // arguments
    // limit
    .option('-l, --limit <number>', 'number of images to fetch', '1') // default of 1
    // show log
    .option('--log', 'enables raw result console log')
    .parse(process.argv);

const options = program.opts();
// limit argument
const limit = parseInt(options.limit, 10);
const log = options.log == true;

// this loads the sites
const site_info = loadSiteInfo();

// asks the site
async function askSite() {
    const answers = await inquirer.prompt({
        type: 'list',
        name: 'site',
        message: 'which site do you wanna fetch from?\n',
        choices: Object.keys(site_info)
    });
    return answers.site
}

// this asks what tags the user wants
async function getTags() {
    console.log('type the tags you want to search for on the input bellow:')
    const answers = await inquirer.prompt({
        name: 'tags',
        type: 'input',
        message: 'tags:'
    });
    return answers.tags;
}
// ts fetches
async function fetchData(site, tags) {
    const spin = createSpinner('searching...').start();
    try {
        const keys = loadUserKeys(site); // this loads the user keys
    } catch {
        const noKey = true
    }
    if (!site_info[site]) {
        spin.error({
            text: `"${site}" not a valid site. sites: ${Object.keys(site_info).join(', ')}`
        });
        process.exit(1);
    }

    const config = site_info[site];
    const params = new URLSearchParams({
        ...config.apiParams,
        tags: encodeURIComponent(tags),
        limit: limit.toString()
    });

    // if the site requires authentication, attach user keys
    if (config.requiresAuth) {
        const keys = loadUserKeys(site);
        for (const keyName of config.authParams) {
            if (keys[keyName]) params.set(keyName, keys[keyName]);
        }
    }


    const url = `${config.baseUrl}?${params.toString()}`;

    const res = await fetch(url);

    if (!res.ok) {
        spin.error({ text: "error! could not fetch data." });
        console.log('you may want to check your API keys on the keys.toml config file.')
        if (log) {
            console.log(res)
        }

        process.exit(1);
    }

    const text = await res.text(); // gets the raw text to check if it's valid json

    // checks if the result is empty
    if (!text.trim()) {
        spin.error({ text: "no results found for the tags." });
        process.exit(0);
    }

    // checks if the data is valid json
    let data;

    try {
        if (config.responseType === 'xml') {
            const xml2js = await import('xml2js');
            data = await xml2js.parseStringPromise(text);
            data = data.posts.post; // adjust depending on structure
        } else {
            data = JSON.parse(text);
        }
    } catch (e) {
        spin.error({ text: "unexpected response from the server." });
        process.exit(1);
    }

    spin.success({ text: "success!" });
    if (log) {
        console.log(data)
    }
    return data
}

// save dialog
async function saveDialog(data) {
    const answers = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'what do you wanna do with the image?\n',
        choices: [
            'save here',
            'copy image url'
        ]
    });

    let posts;

    // normalize structure
    if (Array.isArray(data)) {
        posts = data; // safebooru style
    } else if (data.post && Array.isArray(data.post)) {
        posts = data.post; // gelbooru style
    } else {
        console.error("Unexpected data format.");
        process.exit(1);
    }

    if (answers.action === 'save here') {
        downloadImages(posts);
    } else {
        console.log(chalk.green('you can copy the following link:'));
        for (const post of posts) {
            console.log(post.file_url);
        }
        process.exit(0);
    }
}

// downloads the pictures
async function downloadImages(data) {
    const download = new cliProgress.SingleBar({
        format: 'Downloading [{bar}] {percentage}% | {value}/{total} files'
    }, cliProgress.Presets.shades_classic);

    download.start(data.length, 0);

    let completed = 0;

    for (const post of data) {
        const imgURL = post.file_url;
        const fileName = post.id + path.extname(imgURL);

        // overwrite same line instead of logging a new one
        process.stdout.write(`\rDownloading: ${fileName}...`);

        try {
            const res = await fetch(imgURL);
            if (!res.ok) throw new Error(`failed to fetch ${imgURL}`);

            const buffer = await res.arrayBuffer();
            fs.writeFileSync(fileName, Buffer.from(buffer));

            completed++;
            download.update(completed);
        } catch (err) {
            process.stdout.write(`error saving ${fileName}: ${err.message}\n`);
        }
    }

    download.stop();
    process.stdout.write('All done!');
    process.exit(0);
}

// this is the main code, I might have to change this later
await saveDialog(await fetchData(await askSite(), await getTags()))