import { spawn } from 'child_process';

async function start() {
    console.log('\n\x1b[35m%s\x1b[0m', '🚀 Starting UniTimetable Sharing Suite...');

    // 1. Start ngrok
    const ngrok = spawn('ngrok', ['http', '5173'], { shell: true });

    // 2. Wait for ngrok to provide a URL
    console.log('\x1b[33m%s\x1b[0m', '🌐 Initializing ngrok tunnel...');

    let publicUrl = null;
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const response = await fetch('http://127.0.0.1:4040/api/tunnels');
            const data = await response.json();
            if (data.tunnels && data.tunnels.length > 0) {
                publicUrl = data.tunnels[0].public_url;
                break;
            }
        } catch (e) {
            // Tunnel API not ready yet
        }
    }

    if (!publicUrl) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Failed to get ngrok URL. Make sure ngrok is authenticated.');
        ngrok.kill();
        process.exit(1);
    }

    console.log('\n\x1b[32m%s\x1b[0m', '✨ SUCCESS! Your classmates can access the timetable at:');
    console.log('\x1b[1m\x1b[36m%s\x1b[0m', `   ${publicUrl}`);
    console.log('\x1b[90m%s\x1b[0m', '   (Keep this window open to maintain the connection)\n');

    // 3. Start Vite
    console.log('\x1b[34m%s\x1b[0m', '📦 Starting Vite server via pnpm dev...');
    const vite = spawn('pnpm', ['run', 'dev'], {
        shell: true,
        stdio: 'inherit',
        env: { ...process.env, VITE_NGROK_URL: publicUrl }
    });

    // Cleanup on exit
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        ngrok.kill();
        vite.kill();
        process.exit();
    });

    process.on('SIGTERM', () => {
        ngrok.kill();
        vite.kill();
        process.exit();
    });
}

start();
