@echo off
REM Attendance System Deployment Script for Windows
REM Usage: deploy.bat [environment]

setlocal enabledelayedexpansion
set ENVIRONMENT=%1
if "%ENVIRONMENT%"=="" set ENVIRONMENT=production

echo.
echo ================================
echo Face Recognition Attendance System
echo Deployment Script
echo Environment: %ENVIRONMENT%
echo ================================
echo.

REM Check Node.js installation
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo. x Node.js is not installed
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo. + Node.js %NODE_VERSION% detected

REM Install dependencies
echo. * Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo. x Failed to install dependencies
    exit /b 1
)

REM Check for .env file
if not exist ".env" (
    echo. ! .env file not found, creating from .env.example...
    copy .env.example .env
    echo. + .env created. Please update it with your configuration.
)

REM Create data directory
if not exist "data\" (
    mkdir data
    echo. + Created data directory for SQLite database
)

REM Run in appropriate mode
if "%ENVIRONMENT%"=="development" (
    echo. * Starting in development mode...
    call npm run dev
) else if "%ENVIRONMENT%"=="production" (
    echo. * Starting in production mode...
    call npm start
) else if "%ENVIRONMENT%"=="docker" (
    echo. ! Docker is not directly supported on Windows batch scripts
    echo. ! Please use: docker-compose up
    exit /b 1
) else (
    echo. x Unknown environment: %ENVIRONMENT%
    echo. Usage: deploy.bat [development^|production^|docker]
    exit /b 1
)

echo.
echo ================================
echo + Deployment Complete
echo. Access the app at: http://localhost:3000
echo ================================
echo.

endlocal
