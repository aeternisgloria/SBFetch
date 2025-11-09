#!/usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import fetch from 'node-fetch';
import fs from 'fs';
import { Command } from 'commander';
import path from 'path';

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
const logResult = options.log == true;

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

async function fetchData(site, tags) {
    const spin = createSpinner('searching...').start();

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

    const url = `${config.baseUrl}?${params.toString()}`;

    const res = await fetch(url);

    if (!res.ok) {
        spin.error({ text: "error! could not fetch data." });
        process.exit(1);
    }

    const text = await res.text(); // gets the raw text to check if it's valid json

    // checks if the result is empty
    if (!text.trim()) {
        spin.error({ text: "no results found for the tags." });
        process.exit(0);
    }

    let data;
    // checks if the data is valid json
    try {
        data = JSON.parse(text);
    } catch (e) {
        spin.error({ text: "unexpected response from the server." });
        process.exit(1);
    }

    spin.success({ text: "success!" });
    if (logResult) {
        console.log(result)
    }
    return data
}

function loadSiteInfo() {
    try {
        const configPath = path.join(process.cwd(), 'sites.json');
        if (!fs.existsSync(configPath)) {
            throw new Error('sites.json not found');
        }
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        spin.error({ text: `invalid site info: ${error.message}` });
        process.exit(1);
    }
}

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

    if (answers.action === 'save here') {
        downloadImages(data);
    } else {
        console.log(chalk.green('you can copy the following link:'));
        for (const post of data) {
            console.log(post.file_url);
        }
        process.exit(0);
    }
}


async function downloadImages(data) {
    for (const post of data) {
        const imgURL = post.file_url;
        const fileName = post.id + path.extname(imgURL);

        console.log(`downloading ${fileName}...`);
        try {
            const res = await fetch(imgURL);
            if (!res.ok) throw new Error(`failed to fetch ${imgURL}`);

            const buffer = await res.arrayBuffer();
            fs.writeFileSync(fileName, Buffer.from(buffer));

            console.log(`saved ${fileName}`);
        } catch (err) {
            console.error(`error saving ${imgURL}:`, err.message);
        }
    }
    console.log('all done!');
    process.exit(0);
}

await saveDialog(await fetchData(await askSite(), await getTags()))