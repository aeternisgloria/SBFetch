#! usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import { createSpinner } from 'nanospinner';
import fetch from 'node-fetch';
import fs from 'fs';
import { Command } from 'commander';
import path from 'path';

// set the variables
let tags
let result

// ts sets up command
const program = new Command();
program
    // arguments
    .option('-l, --limit <number>', 'number of images to fetch', '1') // default of 1
    .option('--log', 'enables raw result console log')
    .parse(process.argv);

const options = program.opts();
// limit argument
const limit = parseInt(options.limit, 10);
const logResult = options.log == true;

// basically a fancy wait function
const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

// this asks what tags the user wants
async function getTags() {
    console.log('Type the tags you want to search for on the input bellow:')
    const answers = await inquirer.prompt({
        name: 'tags',
        type: 'input',
        message: 'tags:'
    });
    tags = answers.tags;
}

async function fetchData(tags) {
    const spin = createSpinner('Searching...').start();
    await sleep();

    // this is the api URL
    const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tags)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
        spin.error({ text: "Error! Could not fetch data." });
        process.exit(1);
    }

    const text = await res.text(); // gets the raw text to check if it's valid json

    // checks if the result is empty
    if (!text.trim()) {
        spin.error({ text: "No results found for the tags." });
        return;
    }

    let data;
    // checks if the data is valid json
    try {
        data = JSON.parse(text);
    } catch (e) {
        spin.error({ text: "Invalid response from the server." });
        process.exit(1);
    }

    spin.success({ text: "Success!" });
    result = data
    if (logResult) {
        console.log(result)
    }
}

async function saveDialog() {
    console.log();
    const answers = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'What do you wanna do with the image?\n',
        choices: [
            'save here',
            'copy image url'
        ]
    });

    if (answers.action === 'save here') {
        downloadImages(result);
    } else {
        console.log(chalk.green('You can copy the following link:'));
        for (const post of result) {
            console.log(post.file_url);
        }
        process.exit(0);
    }
}


async function downloadImages(data) {
    for (const post of data) {
        const imgURL = post.file_url;
        const fileName = post.id + path.extname(imgURL);

        console.log(`Downloading ${fileName}...`);
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


// this is what runs the code
console.clear() // clears the console
await getTags();
await fetchData(tags)
await saveDialog()