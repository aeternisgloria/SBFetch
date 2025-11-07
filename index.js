#! usr/bin/env node

import chalk from 'chalk';
import inquirer from 'inquirer';
import gradient from 'gradient-string';
import chalkAnimation from 'chalk-animation';
import figlet from 'figlet';
import { createSpinner } from 'nanospinner';
import fetch from 'node-fetch';
import fs from 'fs';

let tags
let result

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
    const url = `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tags)}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) {
        spin.error({text: "Error! Could not fetch data."});
        process.exit(1);
    }

    const text = await res.text(); // gets the raw text to check if it's valid json

    // checks if the result is empty
    if (!text.trim()) {
        spin.error({text: "No results found for the tags."});
        return;
    }

    let data;
    // checks if the data is valid json
    try {
        data = JSON.parse(text);
    } catch (e) {
        spin.error({text: "Invalid response from the server."});
        process.exit(1);
    }
    
    spin.success({text: "Success!"});
    result = data
    // console.log(data)
}

// this is what runs the code
console.clear() // clears the console
await getTags();
await fetchData(tags)