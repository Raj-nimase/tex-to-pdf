#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "============================================="
echo " Starting Render Build for LaTeX PDF Server"
echo "============================================="

# 1. Install Node.js dependencies
echo "📦 Installing npm dependencies..."
npm install

# 2. Download Tectonic Linux binary (static musl build)
echo "📥 Downloading Tectonic compiler for Linux (x86_64)..."
mkdir -p bin

TECTONIC_VERSION="0.17.0"
DOWNLOAD_URL="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz"

curl -fsSL "${DOWNLOAD_URL}" | tar -xz -C bin/
chmod +x bin/tectonic

# 3. Verify installation
echo "✅ Tectonic installed successfully:"
./bin/tectonic --version

# 4. Optional: Pre-warm LaTeX cache with a minimal test compilation
echo "⚡ Warming up Tectonic format cache..."
echo '\documentclass{article}\begin{document}init\end{document}' > warmup.tex
./bin/tectonic warmup.tex -o . > /dev/null 2>&1 || true
rm -f warmup.*

echo "============================================="
echo " Build completed successfully!"
echo "============================================="
