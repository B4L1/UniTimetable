import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

async function getTunnelUrl(maxRetries = 20, retryDelay = 1000) {
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

function printWelcome() {
    console.log('\n\x1b[35m%s\x1b[0m', '╔════════════════════════════════════════════════════════════╗');
    console.log('\x1b[35m%s\x1b[0m', '║   🚀 UniTimetable - Secure Sharing Mode                   ║');
    console.log('\x1b[35m%s\x1b[0m', '╚════════════════════════════════════════════════════════════╝\n');
}

function printSuccess(url) {
    console.log('\n\x1b[32m%s\x1b[0m', '✨ SUCCESS! Your app is live!');
    console.log('\x1b[1m\x1b[36m%s\x1b[0m', `   📍 Public URL: ${url}`);
    console.log('\x1b[33m%s\x1b[0m', '   ⚠️  Keep this window open to maintain the connection');
    console.log('\x1b[90m%s\x1b[0m', '   💡 Tip: Share this URL with anyone to let them access your app\n');
}

function printError(message) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Error: ${message}`);
}

function saveUrlToFile(url) {
    const tunnelFile = resolve(__dirname, '.env.tunnel');
    try {
        writeFileSync(tunnelFile, `VITE_NGROK_URL=${url}\n`, 'utf-8');
    } catch (e) {
        console.warn('\x1b[90m%s\x1b[0m', `⚠️  Could not save tunnel URL to file: ${e.message}`);
    }
}

async function start() {
    printWelcome();

    // 1. Start ngrok
    console.log('\x1b[33m%s\x1b[0m', '🌐 Initializing ngrok tunnel...');
    const ngrokProcess = spawn('ngrok', ['http', '5173'], {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let ngrokReady = false;
    ngrokProcess.on('error', (err) => {
        if (!ngrokReady) {
            printError('Failed to start ngrok. Make sure it is installed and authenticated.');
            printError('Install ngrok: https://ngrok.com/download');
            printError(`Details: ${err.message}`);
            process.exit(1);
        }
    });

    // 2. Wait for ngrok to provide a URL
    console.log('\x1b[33m%s\x1b[0m', '⏳ Waiting for tunnel URL (this may take a moment)...');

    const publicUrl = await getTunnelUrl(30, 500);

    if (!publicUrl) {
        printError('Failed to get ngrok URL after 30 attempts.');
        printError('Make sure:');
        console.error('\x1b[90m%s\x1b[0m', '   • ngrok is installed and in your PATH');
        console.error('\x1b[90m%s\x1b[0m', '   • ngrok is authenticated with your account');
        console.error('\x1b[90m%s\x1b[0m', '   • No other ngrok process is running on port 5173');
        ngrokProcess.kill();
        process.exit(1);
    }

    ngrokReady = true;
    printSuccess(publicUrl);

    // Save URL to file for reference
    saveUrlToFile(publicUrl);

    // 3. Start Vite dev server
    console.log('\x1b[34m%s\x1b[0m', '📦 Starting development server...');
    const viteProcess = spawn('pnpm', ['run', 'dev'], {
        shell: true,
        stdio: 'inherit',
        env: { ...process.env, VITE_NGROK_URL: publicUrl }
    });

    // Graceful shutdown
    const cleanup = () => {
        console.log('\n\x1b[33m%s\x1b[0m', '🛑 Shutting down gracefully...');
        ngrokProcess.kill();
        viteProcess.kill();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Forward process exit codes
    ngrokProcess.on('exit', (code) => {
        if (code !== 0) {
            console.error('\x1b[31m%s\x1b[0m', `ngrok exited with code ${code}`);
        }
    });

    viteProcess.on('exit', (code) => {
        if (code !== 0) {
            console.error('\x1b[31m%s\x1b[0m', `Dev server exited with code ${code}`);
        }
    });
}

start().catch((err) => {
    printError(err.message);
    process.exit(1);
});
