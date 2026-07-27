#!/usr/bin/env node

/**
 * UniTimetable - Secure Sharing Mode
 * 
 * This script starts ngrok tunnel and the web development server.
 * It automatically captures the public URL and injects it into the environment.
 * 
 * Usage: node scripts/start-sharing.js [--mobile]
 * 
 * Options:
 *   --mobile    Also start the mobile app (experimental)
 *   --port N    ngrok tunnel port (default: 5173 for web)
 *   --help      Show this help message
 */

import { spawn } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

// ============================================================================
// Utility Functions
// ============================================================================

function log(color, symbol, message) {
    const colors = {
        reset: '\x1b[0m',
        bright: '\x1b[1m',
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

function printHeader() {
    console.log('');
    log('magenta', '╔════════════════════════════════════════════════════════════╗', '');
    log('magenta', '║', '   🚀 UniTimetable - Secure Sharing Mode');
    log('magenta', '║', '');
    log('magenta', '║   Share your development server securely with anyone!', '');
    log('magenta', '╚════════════════════════════════════════════════════════════╝', '');
    console.log('');
}

function printFooter(url, details = '') {
    console.log('');
    log('green', '✨', 'SUCCESS! Your app is now live!');
    console.log('');
    log('cyan', '📍', `Public URL: ${url}`);
    if (details) {
        details.split('\n').forEach(line => {
            if (line.trim()) log('gray', '   ', line);
        });
    }
    console.log('');
    log('yellow', '⚠️ ', 'Keep this window open to maintain the connection');
    log('blue', '💡', 'Tip: Share the URL above with anyone to let them access your app');
    console.log('');
}

function printError(title, details = '') {
    console.log('');
    log('red', '❌', title);
    if (details) {
        details.split('\n').forEach(line => {
            if (line.trim()) log('gray', '   ', line);
        });
    }
    console.log('');
}

async function getTunnelUrl(maxRetries = 30, retryDelay = 500) {
    for (let i = 0; i < maxRetries; i++) {
        await new Promise(r => setTimeout(r, retryDelay));
        try {
            const response = await fetch('http://127.0.0.1:4040/api/tunnels');
            const data = await response.json();
            if (data.tunnels && data.tunnels.length > 0) {
                return data.tunnels[0].public_url;
            }
        } catch (e) {
            // Tunnel API not ready yet
        }
    }
    return null;
}

async function checkGcloudAvailable() {
    return new Promise((resolve) => {
        const test = spawn('gcloud', ['--version'], {
            shell: true,
            stdio: 'ignore'
        });
        test.on('error', () => resolve(false));
        test.on('exit', (code) => resolve(code === 0));
    });
}

function saveConfigFiles(publicUrl) {
    const files = [
        {
            path: resolve(projectRoot, 'packages/web/.env.tunnel'),
            content: `# Auto-generated ngrok tunnel URL\n# This file is created by scripts/start-sharing.js\nVITE_NGROK_URL=${publicUrl}\n`
        }
    ];

    files.forEach(({ path, content }) => {
        try {
            writeFileSync(path, content, 'utf-8');
        } catch (e) {
            log('gray', '⚠️ ', `Could not save config: ${e.message}`);
        }
    });

    // Extract domain from ngrok URL (e.g., "abc123.ngrok-free.dev" from "https://abc123.ngrok-free.dev")
    const domain = publicUrl.replace('https://', '').replace('http://', '').split('/')[0];
    log('gray', '   ', `Ngrok domain: ${domain}`);
}

function checkPrerequisites() {
    // Check if ngrok is available by trying to spawn it
    return new Promise((resolve) => {
        const test = spawn('ngrok', ['--version'], {
            shell: true,
            stdio: 'ignore'
        });
        test.on('error', () => resolve(false));
        test.on('exit', (code) => resolve(code === 0));
    });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
    const args = process.argv.slice(2);
    const showHelp = args.includes('--help');
    const startMobile = args.includes('--mobile');
    const portIndex = args.indexOf('--port');
    const customPort = portIndex !== -1 ? args[portIndex + 1] : '5173';

    if (showHelp) {
        console.log(`
UniTimetable - Secure Sharing Mode

Usage: node scripts/start-sharing.js [options]

Options:
  --mobile      Also start the mobile app (Expo)
  --port N      ngrok tunnel port (default: 5173)
  --help        Show this help message

Examples:
  # Start web app with ngrok tunnel
  node scripts/start-sharing.js

  # Start both web and mobile apps
  node scripts/start-sharing.js --mobile

  # Use custom port
  node scripts/start-sharing.js --port 3000
        `);
        process.exit(0);
    }

    printHeader();

    // Check prerequisites
    log('yellow', '⏳', 'Checking prerequisites...');
    const ngrokAvailable = await checkPrerequisites();
    if (!ngrokAvailable) {
        printError(
            'ngrok is not installed or not in your PATH',
            'Install ngrok from: https://ngrok.com/download\n' +
            'Then authenticate with: ngrok config add-authtoken <YOUR_TOKEN>'
        );
        process.exit(1);
    }

    // Start ngrok tunnel
    log('yellow', '🌐', `Initializing ngrok tunnel on port ${customPort}...`);
    const ngrokProcess = spawn('ngrok', ['http', customPort], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let ngrokReady = false;
    ngrokProcess.on('error', (err) => {
        if (!ngrokReady) {
            printError('Failed to start ngrok', `Details: ${err.message}`);
            process.exit(1);
        }
    });

    // Wait for tunnel URL
    log('blue', '⏳', 'Waiting for tunnel URL (this may take a moment)...');
    const publicUrl = await getTunnelUrl();

    if (!publicUrl) {
        printError(
            'Failed to get ngrok URL after 30 attempts',
            'Make sure:\n' +
            '  • ngrok is installed and in your PATH\n' +
            '  • ngrok is authenticated: https://ngrok.com/docs/guides/dashboard/\n' +
            '  • No other ngrok process is running on port ' + customPort
        );
        ngrokProcess.kill();
        process.exit(1);
    }

    ngrokReady = true;

    // Save config files
    saveConfigFiles(publicUrl);

    // Check if gcloud is available for automatic Google OAuth update
    const gcloudAvailable = await checkGcloudAvailable();

    // Build details
    let details = 'Web app will be available at the URL above';
    if (startMobile) {
        details += '\nMobile app is starting in a separate window...';
    }
    
    if (!gcloudAvailable) {
        details += '\n\n⚠️  IMPORTANT - If you get a Google Login error:';
        details += '\n1. Go to: https://console.cloud.google.com/apis/credentials';
        details += '\n2. Find the OAuth 2.0 Client ID (Authorized redirect URIs)';
        details += '\n3. Add this URI:';
        details += `\n   ${publicUrl}/auth/google/callback`;
        details += '\n4. Refresh the page and try logging in again';
    } else {
        details += '\n\n📝 Google Cloud CLI detected!';
        details += '\nSetup Google OAuth with:';
        details += `\n   gcloud compute backend-services update YOUR-SERVICE --global --iap=enabled --oauth-client-id=YOUR_CLIENT_ID --oauth-client-secret=YOUR_SECRET`;
        details += `\nOr manually add to: https://console.cloud.google.com/apis/credentials`;
        details += `\n   ${publicUrl}/auth/google/callback`;
    }
    printFooter(publicUrl, details);

    // Start web dev server
    log('blue', '📦', 'Starting web development server...');
    const webEnv = { ...process.env, VITE_NGROK_URL: publicUrl };
    const webProcess = spawn('pnpm', ['--filter', '@unitimetable/web', 'run', 'dev'], {
        shell: true,
        stdio: 'inherit',
        env: webEnv,
        cwd: projectRoot
    });

    // Optionally start mobile
    let mobileProcess = null;
    if (startMobile) {
        log('blue', '📱', 'Starting mobile development server...');
        mobileProcess = spawn('pnpm', ['--filter', '@unitimetable/mobile', 'start'], {
            shell: true,
            stdio: 'inherit',
            cwd: projectRoot
        });
    }

    // Graceful shutdown
    const cleanup = () => {
        log('yellow', '🛑', 'Shutting down...');
        ngrokProcess.kill();
        webProcess.kill();
        if (mobileProcess) mobileProcess.kill();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Log exit codes
    ngrokProcess.on('exit', (code) => {
        if (code !== 0) {
            log('red', '❌', `ngrok exited with code ${code}`);
        }
    });

    webProcess.on('exit', (code) => {
        if (code !== 0) {
            log('red', '❌', `Web server exited with code ${code}`);
        }
    });
}

main().catch((err) => {
    printError('Unexpected error', err.message);
    process.exit(1);
});
