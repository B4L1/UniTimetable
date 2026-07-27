# 🚀 UniTimetable - Secure Sharing Guide

This guide explains how to share your UniTimetable development server securely with classmates using ngrok tunneling.

## Quick Start

### Prerequisites

1. **Install ngrok** (if you haven't already):
   - Download from: https://ngrok.com/download
   - Or install via package manager:
     ```bash
     # macOS (Homebrew)
     brew install ngrok

     # Windows (Chocolatey)
     choco install ngrok

     # Linux (Snap)
     sudo snap install ngrok
     ```

2. **Authenticate ngrok**:
   - Sign up for a free account at https://ngrok.com
   - Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken
   - Run: `ngrok config add-authtoken YOUR_TOKEN_HERE`

### Option 1: Share Web App (Recommended)

Run this command from the project root:

```bash
pnpm share
```

That's it! 🎉 The script will:
- Start ngrok tunnel
- Launch the web development server
- Display a shareable public URL
- Keep everything running until you press `Ctrl+C`

### Option 2: Share Web + Mobile Apps

```bash
pnpm share:mobile
```

This starts both the web and mobile development servers with the same ngrok tunnel.

### Get Help

```bash
pnpm share:help
```

## What Happens Behind the Scenes

1. **ngrok tunnel is created** on port 5173 (web server port)
   - You get a public URL like `https://abc123.ngrok-free.app`
   - This URL routes traffic to your local machine

2. **Environment variable is set** `VITE_NGROK_URL`
   - Your app detects it's being accessed via ngrok
   - All URLs are automatically configured

3. **Web server starts** with the ngrok URL injected
   - The app is accessible at the public URL
   - Classmates can visit it from anywhere

4. **Config file is generated** at `.env.tunnel`
   - Stores the current ngrok URL for reference
   - Automatically cleaned up when you stop sharing

## Sharing the URL with Classmates

Once the script runs, you'll see output like:

```
✨ SUCCESS! Your app is now live!

📍 Public URL: https://abc123.ngrok-free.app
```

**Share that URL** with anyone you want to give access to your app. They can:
- Open it in a browser
- Share it further
- Access it from mobile devices

## Troubleshooting

### ❌ "ngrok is not installed or not in your PATH"

**Solution**: 
1. Install ngrok: https://ngrok.com/download
2. Make sure it's in your system PATH (you should be able to run `ngrok --version` from any terminal)
3. On Windows, you may need to restart your terminal after installing

### ❌ "Failed to get ngrok URL after 30 attempts"

**Solution**:
1. Check if ngrok is authenticated: `ngrok config check`
2. If not authenticated, get a token from https://dashboard.ngrok.com/get-started/your-authtoken
3. Authenticate: `ngrok config add-authtoken YOUR_TOKEN`
4. Make sure no other ngrok process is running on port 5173

### ❌ "The URL shows an error when I visit it"

**Solution**:
1. Make sure the ngrok terminal is still running (it says "Keep this window open")
2. Check that your dev server started successfully (should see Vite logs)
3. Wait 5-10 seconds for the tunnel to fully establish
4. Try refreshing the page

### ❌ "Google Login doesn't work on the ngrok URL"

**This is expected!** Google OAuth needs the domain whitelisted.

**Solution**:
1. The script shows instructions in the terminal (look for the blue box)
2. Go to: https://console.cloud.google.com/apis/credentials
3. Find "Authorized redirect URIs" for the OAuth 2.0 Client ID
4. Add the ngrok URL: `https://YOUR-NGROK-URL/auth/google/callback`
5. Refresh the page and try logging in again

**Quick example:**
```
If your ngrok URL is: https://abc123.ngrok-free.dev
Add this to Google: https://abc123.ngrok-free.dev/auth/google/callback
```

Then it will work! ✅

## Advanced Usage

### Use a Custom Port

```bash
node start-sharing.js --port 3000
```

### Start Only the Web App (from web package)

Navigate to `packages/web/` and run:

```bash
npm run share
```

This uses the optimized script in that package.

### Manual Ngrok (If Script Fails)

```bash
# Terminal 1: Start ngrok manually
ngrok http 5173

# Terminal 2: Start dev server
pnpm dev:web VITE_NGROK_URL=https://YOUR_URL.ngrok-free.app
```

## How It Works Technically

The automation scripts:

1. **`start-sharing.js`** (root level)
   - Starts ngrok tunnel
   - Polls ngrok's API for the public URL
   - Launches the dev server with the URL injected as an environment variable
   - Saves the URL to `.env.tunnel` for reference
   - Handles graceful shutdown (Ctrl+C)

2. **`start-tunnel.js`** (web package level)
   - Simpler version focused on web-only sharing
   - Can be run independently from the web package

3. **Vite Configuration**
   - Already configured to accept `.ngrok-free.app` in `vite.config.ts`
   - Allows the app to be accessed via ngrok domains

## Tips & Best Practices

✅ **DO:**
- Keep the terminal window open while people are using your app
- Share the URL with a time limit ("available until 3 PM today")
- Test the URL yourself before sending it to classmates
- Use `Ctrl+C` to cleanly stop sharing

❌ **DON'T:**
- Close the terminal with the ngrok process running
- Share URLs publicly on the internet (they expire automatically)
- Leave sensitive data in your app when sharing
- Use ngrok for production (it's for testing only)

## Need More Help?

- ngrok docs: https://ngrok.com/docs
- Project repo: [Add your GitHub link]
- Contact your project maintainer

---

Happy sharing! 🚀
