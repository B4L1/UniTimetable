# UniTimetable - Secure Sharing Mode (PowerShell)
# 
# This script starts ngrok tunnel and the web development server.
# Works on Windows 10+
#
# Usage: ./start-sharing.ps1 [-Mobile] [-Port 5173] [-Help]
#
# Note: You may need to run this command first:
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

param(
    [switch]$Mobile,
    [string]$Port = "5173",
    [switch]$Help
)

function Write-ColorOutput ($color, $prefix, $message) {
    $colorMap = @{
        'red'     = [ConsoleColor]::Red
        'green'   = [ConsoleColor]::Green
        'yellow'  = [ConsoleColor]::Yellow
        'blue'    = [ConsoleColor]::Blue
        'magenta' = [ConsoleColor]::Magenta
        'cyan'    = [ConsoleColor]::Cyan
        'gray'    = [ConsoleColor]::Gray
    }
    
    $c = $colorMap[$color]
    Write-Host $prefix -ForegroundColor $c -NoNewline
    Write-Host " $message"
}

function Test-CommandExists {
    param($command)
    $null = & { Invoke-Expression -Command "Get-Command $command -ErrorAction Stop" } 2>&1
    return $?
}

if ($Help) {
    @"

UniTimetable - Secure Sharing Mode (PowerShell)

Usage: .\start-sharing.ps1 [options]

Options:
  -Mobile      Also start the mobile app (Expo)
  -Port N      ngrok tunnel port (default: 5173)
  -Help        Show this help message

Examples:
  # Start web app with ngrok tunnel
  .\start-sharing.ps1

  # Start both web and mobile apps
  .\start-sharing.ps1 -Mobile

  # Use custom port
  .\start-sharing.ps1 -Port 3000

Note: You may need to enable script execution first:
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

"@
    exit 0
}

Write-Host ""
Write-ColorOutput "magenta" "╔════════════════════════════════════════════════════════════╗" ""
Write-ColorOutput "magenta" "║" "   🚀 UniTimetable - Secure Sharing Mode"
Write-ColorOutput "magenta" "║" ""
Write-ColorOutput "magenta" "║" "   Share your development server securely with anyone!"
Write-ColorOutput "magenta" "╚════════════════════════════════════════════════════════════╝" ""
Write-Host ""

# Check prerequisites
Write-ColorOutput "yellow" "⏳" "Checking prerequisites..."

if (-not (Test-CommandExists "node")) {
    Write-ColorOutput "red" "❌" "Node.js is not installed or not in your PATH"
    Write-ColorOutput "gray" "   " "Please install from: https://nodejs.org"
    exit 1
}

if (Test-CommandExists "pnpm") {
    $PM = "pnpm"
} elseif (Test-CommandExists "npm") {
    Write-ColorOutput "yellow" "⚠️ " "pnpm not found, using npm instead"
    $PM = "npm"
} else {
    Write-ColorOutput "red" "❌" "Neither pnpm nor npm is installed"
    exit 1
}

if (-not (Test-CommandExists "ngrok")) {
    Write-ColorOutput "red" "❌" "ngrok is not installed or not in your PATH"
    Write-ColorOutput "gray" "   " "Install from: https://ngrok.com/download"
    exit 1
}

# Start ngrok
Write-ColorOutput "yellow" "🌐" "Initializing ngrok tunnel on port $Port..."

$ngrokProcess = Start-Process -FilePath "ngrok" -ArgumentList "http", $Port -PassThru -WindowStyle Hidden

# Wait for tunnel URL
Write-ColorOutput "blue" "⏳" "Waiting for tunnel URL (this may take a moment)..."

$publicUrl = $null
$attempts = 0
while (-not $publicUrl -and $attempts -lt 30) {
    Start-Sleep -Milliseconds 500
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -ErrorAction Stop
        if ($response.tunnels -and $response.tunnels.count -gt 0) {
            $publicUrl = $response.tunnels[0].public_url
        }
    } catch {
        # API not ready yet
    }
    $attempts++
}

if (-not $publicUrl) {
    Write-ColorOutput "red" "❌" "Failed to get ngrok URL after 30 attempts"
    Write-ColorOutput "gray" "   " "Make sure:"
    Write-ColorOutput "gray" "   " "  • ngrok is installed and in your PATH"
    Write-ColorOutput "gray" "   " "  • ngrok is authenticated: https://ngrok.com/docs/guides/dashboard/"
    Write-ColorOutput "gray" "   " "  • No other ngrok process is running"
    Stop-Process -Id $ngrokProcess.Id
    exit 1
}

# Display success message
Write-Host ""
Write-ColorOutput "green" "✨" "SUCCESS! Your app is now live!"
Write-Host ""
Write-ColorOutput "cyan" "📍" "Public URL: $publicUrl"
Write-ColorOutput "gray" "   " "Web app will be available at the URL above"
Write-Host ""
Write-ColorOutput "yellow" "⚠️ " "Keep this window open to maintain the connection"
Write-ColorOutput "blue" "💡" "Tip: Share the URL above with anyone to let them access your app"
Write-Host ""

# Save tunnel info
$envContent = "# Auto-generated ngrok tunnel URL`n# This file is created by start-sharing.ps1`nVITE_NGROK_URL=$publicUrl`n"
Set-Content -Path "packages/web/.env.tunnel" -Value $envContent -Force

# Start dev server
Write-ColorOutput "blue" "📦" "Starting web development server..."

$webProcess = Start-Process -FilePath $PM `
    -ArgumentList @("--filter", "@unitimetable/web", "run", "dev") `
    -PassThru `
    -NoNewWindow `
    -EnvironmentVariables @{"VITE_NGROK_URL" = $publicUrl}

# Handle cleanup
$cleanup = {
    Write-Host ""
    Write-ColorOutput "yellow" "🛑" "Shutting down..."
    Stop-Process -Id $ngrokProcess.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $webProcess.Id -ErrorAction SilentlyContinue
    exit 0
}

Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action $cleanup | Out-Null

# Wait for processes
Wait-Process -Id $webProcess.Id -ErrorAction SilentlyContinue
$cleanup.Invoke()
