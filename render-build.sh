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

# 4. Pre-warm LaTeX cache with popular packages (amsmath, geometry, hyperref, titlesec, enumitem, etc.)
echo "⚡ Pre-warming Tectonic format and package cache..."
cat << 'EOF' > warmup.tex
\documentclass[11pt,a4paper]{article}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{geometry}
\usepackage{hyperref}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{array}
\usepackage{booktabs}
\begin{document}
Warmup compilation
\end{document}
EOF
./bin/tectonic warmup.tex -o . || true
rm -f warmup.*

echo "============================================="
echo " Build completed successfully!"
echo "============================================="
