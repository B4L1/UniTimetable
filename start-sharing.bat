@echo off
REM UniTimetable - Quick Share Script for Windows
REM This is a convenience wrapper for the sharing script
REM Usage: start-sharing.bat [options]

setlocal enabledelayedexpansion

REM Check if Node.js is installed
where /q node.exe
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js is not installed or not in your PATH
    echo Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM Check if pnpm is installed
where /q pnpm
if errorlevel 1 (
    echo.
    echo [WARNING] pnpm is not installed or not in your PATH
    echo Trying to use npm instead...
    set PM=npm
) else (
    set PM=pnpm
)

REM Check if ngrok is installed
where /q ngrok
if errorlevel 1 (
    echo.
    echo [ERROR] ngrok is not installed or not in your PATH
    echo Please install ngrok from: https://ngrok.com/download
    echo.
    pause
    exit /b 1
)

REM Run the sharing script
echo.
echo Starting UniTimetable Secure Sharing...
echo.

node start-sharing.js %*
