#!/bin/bash
# Build script for MedTourney project
# Compiles TypeScript and prepares files for deployment

set -e  # Exit on error

echo "🔨 Building MedTourney v2.0..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
    echo ""
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
npm run clean
echo ""

# Run type checking
echo "🔍 Running TypeScript type check..."
npm run type-check
echo ""

# Build TypeScript
echo "🏗️  Building TypeScript..."
npm run build
echo ""

# Copy compiled JavaScript to root for GitHub Pages
echo "📋 Copying compiled JavaScript to root..."
cp dist/app.js app.js
echo ""

# Verify build
if [ -f "dist/app.js" ] && [ -f "app.js" ]; then
    echo "✅ Build successful!"
    echo "   - TypeScript compiled: dist/app.js"
    echo "   - Deployed version: app.js"
    echo ""
    echo "📊 File sizes:"
    ls -lh dist/app.js app.js | awk '{print "   ", $9, "-", $5}'
else
    echo "❌ Build failed! Missing output files."
    exit 1
fi

echo ""
echo "🎉 Build complete! You can now:"
echo "   1. Test locally: open index.html in a browser"
echo "   2. Deploy: commit and push app.js"
echo "   3. Run tests: npm test"
