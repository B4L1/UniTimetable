# 🚀 UniTimetable Quick Share - Reference Card

## One-Line Start
```bash
pnpm share
```

## Common Commands

| Command | What It Does |
|---------|------------|
| `pnpm share` | Start sharing web app with ngrok tunnel |
| `pnpm share:mobile` | Start sharing web + mobile apps |
| `pnpm share:help` | Show detailed help |
| `pnpm setup:verify` | Check if everything is installed |
| `pnpm dev:web` | Run dev server without sharing (localhost only) |

## First Time Setup

1. **Install ngrok** (if not already installed)
   - Download: https://ngrok.com/download
   - Or: `brew install ngrok` (macOS)

2. **Get ngrok token**
   - Sign up: https://ngrok.com
   - Get token: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Authenticate ngrok**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

4. **Verify setup**
   ```bash
   pnpm setup:verify
   ```

## Quick Start Flow

```
pnpm share
  ↓
[Terminal shows: Initializing ngrok tunnel...]
  ↓
[Terminal shows: ✨ SUCCESS! Your app is live!]
[Terminal shows: 📍 Public URL: https://abc123.ngrok-free.app]
  ↓
Copy URL and share with classmates!
  ↓
Keep terminal open
  ↓
Press Ctrl+C to stop sharing
```

## What They'll See

Classmates can visit the URL in their browser and will see:
- Your live web app
- All real-time updates
- Everything works exactly like localhost but from their devices

## File Locations

```
unitimetable/
├── start-sharing.js         ← Main script
├── start-sharing.bat        ← Windows convenience
├── start-sharing.sh         ← macOS/Linux convenience
├── setup-verify.js          ← Verification tool
├── SHARING_GUIDE.md         ← Full documentation
└── package.json             ← Scripts added here
```

## Sharing Tips

✅ **Copy-paste the URL** from the terminal
✅ **Test it yourself first** before sharing
✅ **Keep the terminal running** while others access it
✅ **Close it when done** (Ctrl+C) to stop sharing
✅ **Share just the URL** - they don't need any setup

❌ Don't close the terminal while sharing
❌ Don't share publicly (it's for classmates only)
❌ Don't leave sensitive data in the shared version

## Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| "ngrok not found" | Install from https://ngrok.com/download |
| "Not authenticated" | Run: `ngrok config add-authtoken TOKEN` |
| "Port in use" | Use different port: `node start-sharing.js --port 3000` |
| "App broken on URL" | Refresh the page, check console for CORS errors |
| Need help | Read `SHARING_GUIDE.md` or run `pnpm share:help` |

## Mobile Support

To also share the Expo mobile app:
```bash
pnpm share:mobile
```

This starts both web and mobile with the same tunnel.

## Custom Configuration

### Use different port
```bash
node start-sharing.js --port 3000
```

### Show help
```bash
pnpm share:help
```

### Just verify setup (don't start)
```bash
pnpm setup:verify
```

---

**Questions?** See `SHARING_GUIDE.md` for detailed documentation.
