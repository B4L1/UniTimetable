# 🔐 Google Cloud CLI Setup (Optional - For Auto OAuth Updates)

If you want to **automatically update Google OAuth redirect URIs** when sharing, you can set up the Google Cloud CLI (`gcloud`).

## Installation

### Windows
```bash
# Using Chocolatey
choco install gcloud

# Or download from
https://cloud.google.com/sdk/docs/install-cloud-sdk
```

### macOS
```bash
# Using Homebrew
brew install google-cloud-sdk

# Or download from
https://cloud.google.com/sdk/docs/install-cloud-sdk
```

### Linux
```bash
# See: https://cloud.google.com/sdk/docs/install-cloud-sdk
```

After installation, verify:
```bash
gcloud --version
```

## Authentication

1. **Initialize gcloud**:
   ```bash
   gcloud init
   ```

2. **Authenticate**:
   ```bash
   gcloud auth login
   ```
   This will open a browser to sign in with your Google account.

3. **Set your project**:
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```
   Replace `YOUR_PROJECT_ID` with your Google Cloud project ID.

## How It Works With UniTimetable

When you run `pnpm share` with `gcloud` installed, the script will:

1. Detect that `gcloud` is available
2. Show you additional setup information in the terminal
3. Display the exact command to run for your OAuth configuration

**Note**: Full automatic updating requires additional setup with service accounts and IAM permissions. For now, `gcloud` detection helps show better instructions.

## Manual OAuth Setup (Still Works)

If you don't set up `gcloud`, the script will show you the manual steps to add the redirect URI:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click the OAuth 2.0 Client ID
3. Add the ngrok URL to "Authorized redirect URIs"
4. Save

This takes ~30 seconds and only needs to be done once per ngrok session.

## Future Enhancements

In the future, we can set up full automation using:
- Google Cloud Service Accounts
- gcloud OAuth2 client management
- Automated credential updates

For now, having `gcloud` installed just provides better instructions and setup guidance.

## Troubleshooting

**"gcloud: command not found"**
- Reinstall gcloud from: https://cloud.google.com/sdk/docs/install-cloud-sdk
- Add it to your PATH if needed

**"Not authenticated"**
- Run: `gcloud auth login`
- Follow the browser prompts

**"No default project"**
- Run: `gcloud config set project YOUR_PROJECT_ID`
- Get your project ID from: https://console.cloud.google.com

---

**Optional but useful!** 🚀
