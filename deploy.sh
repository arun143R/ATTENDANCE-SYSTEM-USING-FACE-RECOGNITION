#!/bin/bash

# Attendance System Deployment Script
# Usage: ./deploy.sh [environment]

ENVIRONMENT=${1:-production}
VERSION=$(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')

echo "================================"
echo "Face Recognition Attendance System"
echo "Deployment Script v$VERSION"
echo "Environment: $ENVIRONMENT"
echo "================================"

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✅ Node.js $(node --version) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found, creating from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Please update it with your configuration."
fi

# Create data directory
if [ ! -d "data" ]; then
    mkdir -p data
    echo "✅ Created data directory for SQLite database"
fi

# Run in appropriate mode
if [ "$ENVIRONMENT" = "development" ]; then
    echo "🚀 Starting in development mode..."
    npm run dev
elif [ "$ENVIRONMENT" = "production" ]; then
    echo "🚀 Starting in production mode..."
    npm start
elif [ "$ENVIRONMENT" = "docker" ]; then
    echo "🐳 Building Docker image..."
    docker build -t attendance-system:$VERSION .
    echo "✅ Docker image built"
    echo "🚀 Starting with Docker Compose..."
    docker-compose up -d
    echo "✅ Application running in Docker"
else
    echo "❌ Unknown environment: $ENVIRONMENT"
    echo "Usage: ./deploy.sh [development|production|docker]"
    exit 1
fi

echo "================================"
echo "✅ Deployment Complete"
echo "Access the app at: http://localhost:3000"
echo "================================"
