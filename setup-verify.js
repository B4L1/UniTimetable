#!/usr/bin/env node

/**
 * UniTimetable - Setup Verification Script
 * 
 * Checks if all prerequisites for secure sharing are installed
 * and properly configured.
 * 
 * Usage: node setup-verify.js
 */

import { spawn } from 'child_process';

function log(color, symbol, message) {
    const colors = {
        reset: '\x1b[0m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        gray: '\x1b[90m',
    };
    console.log(`${colors[color] || ''}${symbol}${colors.reset}`, message);
}

async function checkCommand(cmd, args = ['--version']) {
    return new Promise((resolve) => {
        const process = spawn(cmd, args, {
            shell: true,
            stdio: 'pipe'
        });

        let output = '';
        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.on('error', () => {
            resolve(null);
        });

        process.on('exit', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                resolve(null);
            }
        });
    });
}

async function checkNgrokAuth() {
    return new Promise((resolve) => {
        const process = spawn('ngrok', ['config', 'check'], {
            shell: true,
            stdio: 'pipe'
        });

        let output = '';
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        process.stderr.on('data', (data) => {
            output += data.toString();
        });

        process.on('error', () => {
            resolve(false);
        });

        process.on('exit', (code) => {
            resolve(code === 0);
        });
    });
}

async function main() {
    console.log('');
    log('magenta', '🔍', 'UniTimetable - Setup Verification');
    console.log('');

    const checks = [];
    let allPassed = true;

    // Check Node.js
    log('blue', '⏳', 'Checking Node.js...');
    const nodeVersion = await checkCommand('node');
    if (nodeVersion) {
        log('green', '✓', `Node.js: ${nodeVersion}`);
        checks.push(true);
    } else {
        log('red', '✗', 'Node.js: NOT INSTALLED');
        checks.push(false);
        allPassed = false;
    }

    // Check pnpm
    log('blue', '⏳', 'Checking pnpm...');
    const pnpmVersion = await checkCommand('pnpm');
    if (pnpmVersion) {
        log('green', '✓', `pnpm: ${pnpmVersion}`);
        checks.push(true);
    } else {
        log('yellow', '⚠', 'pnpm: NOT INSTALLED (optional, npm can be used)');
        checks.push(true);
    }

    // Check ngrok
    log('blue', '⏳', 'Checking ngrok...');
    const ngrokVersion = await checkCommand('ngrok');
    if (ngrokVersion) {
        log('green', '✓', `ngrok: ${ngrokVersion.split('\n')[0]}`);
        checks.push(true);

        // Check ngrok authentication
        log('blue', '⏳', 'Checking ngrok authentication...');
        const ngrokAuth = await checkNgrokAuth();
        if (ngrokAuth) {
            log('green', '✓', 'ngrok: Authenticated');
            checks.push(true);
        } else {
            log('red', '✗', 'ngrok: NOT AUTHENTICATED');
            log('gray', '   ', 'Run: ngrok config add-authtoken YOUR_TOKEN');
            log('gray', '   ', 'Get your token: https://dashboard.ngrok.com/get-started/your-authtoken');
            checks.push(false);
            allPassed = false;
        }
    } else {
        log('red', '✗', 'ngrok: NOT INSTALLED');
        log('gray', '   ', 'Download: https://ngrok.com/download');
        checks.push(false);
        allPassed = false;
    }

    // Check gcloud (optional)
    log('blue', '⏳', 'Checking gcloud...');
    const gcloudVersion = await checkCommand('gcloud');
    if (gcloudVersion) {
        log('green', '✓', `gcloud: INSTALLED (optional, for automatic OAuth updates)`);
        checks.push(true);
    } else {
        log('yellow', '⚠', 'gcloud: NOT INSTALLED (optional, for automatic OAuth updates)');
        log('gray', '   ', 'See: GCLOUD_SETUP.md for optional setup');
        checks.push(true);
    }

    console.log('');
    if (allPassed) {
        log('green', '✨', 'All checks passed! You\'re ready to share.');
        console.log('');
        log('cyan', '💡', 'To get started, run:');
        log('gray', '   ', 'pnpm share');
        console.log('');
    } else {
        log('red', '❌', 'Some checks failed. Please fix the issues above.');
        console.log('');
        log('cyan', '📖', 'For help, see: SHARING_GUIDE.md');
        console.log('');
        process.exit(1);
    }

    console.log('');
}

main().catch((err) => {
    log('red', '❌', `Error: ${err.message}`);
    process.exit(1);
});
