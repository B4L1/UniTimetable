#!/bin/bash

# UniTimetable - Quick Share Script for macOS/Linux
# This is a convenience wrapper for the sharing script
# Usage: ./start-sharing.sh [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js is not installed${NC}"
    echo "Please install Node.js from: https://nodejs.org"
    exit 1
fi

# Check if pnpm is installed
if command -v pnpm &> /dev/null; then
    PM="pnpm"
elif command -v npm &> /dev/null; then
    echo -e "${YELLOW}[WARNING] pnpm not found, using npm instead${NC}"
    PM="npm"
else
    echo -e "${RED}[ERROR] Neither pnpm nor npm is installed${NC}"
    exit 1
fi

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}[ERROR] ngrok is not installed${NC}"
    echo "Please install ngrok from: https://ngrok.com/download"
    echo ""
    echo "On macOS with Homebrew:"
    echo "  brew install ngrok"
    echo ""
    echo "On Linux with Snap:"
    echo "  sudo snap install ngrok"
    exit 1
fi

echo ""
echo -e "${GREEN}Starting UniTimetable Secure Sharing...${NC}"
echo ""

# Run the sharing script
node start-sharing.js "$@"
