import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const binDir = path.join(projectRoot, 'bin');
const isWin = process.platform === 'win32';
const tectonicBinName = isWin ? 'tectonic.exe' : 'tectonic';
const tectonicPath = path.join(binDir, tectonicBinName);

const TECTONIC_VERSION = '0.17.0';

/**
 * Downloads a file following redirects.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    function get(currentUrl) {
      https.get(currentUrl, {
        headers: { 'User-Agent': 'Node-Latex-Offline-Setup' }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }

    get(url);
  });
}

/**
 * Unzips a zip file on Windows using PowerShell or tar.
 */
function extractArchive(archivePath, destDir) {
  if (isWin) {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  }
}

async function ensureTectonicInstalled() {
  if (fs.existsSync(tectonicPath)) {
    console.log(`✅ Tectonic executable found at: ${tectonicPath}`);
    return;
  }

  console.log(`📥 Tectonic executable not found. Downloading Tectonic v${TECTONIC_VERSION} for ${process.platform}...`);
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  let downloadUrl = '';
  let archiveName = '';

  if (isWin) {
    archiveName = `tectonic-${TECTONIC_VERSION}-x86_64-pc-windows-msvc.zip`;
    downloadUrl = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/${archiveName}`;
  } else if (process.platform === 'darwin') {
    archiveName = `tectonic-${TECTONIC_VERSION}-x86_64-apple-darwin.tar.gz`;
    downloadUrl = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/${archiveName}`;
  } else {
    archiveName = `tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz`;
    downloadUrl = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/${archiveName}`;
  }

  const archivePath = path.join(binDir, archiveName);
  console.log(`   Downloading from: ${downloadUrl}`);
  await downloadFile(downloadUrl, archivePath);
  console.log('   Extracting archive...');
  extractArchive(archivePath, binDir);
  fs.unlinkSync(archivePath);

  if (!isWin) {
    fs.chmodSync(tectonicPath, 0o755);
  }

  console.log('✅ Tectonic binary downloaded and installed.');
}

/**
 * Runs a compilation using Tectonic.
 */
function runTectonic(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(tectonicPath, args, { cwd, stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Tectonic exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Pre-warms the Tectonic cache with comprehensive LaTeX packages so it works offline.
 */
async function prewarmOfflineCache() {
  console.log('\n🔥 Pre-warming comprehensive LaTeX packages for OFFLINE use...');
  console.log('   (Downloading packages and fonts once now so you can use them completely offline later)');

  const tempWarmupDir = path.join(projectRoot, 'temp', 'setup_warmup');
  if (!fs.existsSync(tempWarmupDir)) {
    fs.mkdirSync(tempWarmupDir, { recursive: true });
  }

  const warmupDoc = `\\documentclass[11pt,a4paper]{article}
\\usepackage{amsmath,amssymb,amsthm,mathtools}
\\usepackage{geometry}
\\usepackage{fancyhdr}
\\usepackage{hyperref}
\\usepackage{url}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{graphicx}
\\usepackage{xcolor}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{tabularx}
\\usepackage{multirow}
\\usepackage{caption}
\\usepackage{subcaption}
\\usepackage{multicol}
\\usepackage{listings}
\\usepackage{microtype}
\\usepackage{cite}
\\usepackage{tikz}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\begin{document}
\\title{Offline Pre-warm Verification}
\\author{Local Tectonic Setup}
\\maketitle
\\section{Offline Mathematics}
Euler's equation: $e^{i\\pi} + 1 = 0$
Formula: $E = mc^2 + \\sum_{i=1}^{n} x_i^2 + \\int_0^\\infty e^{-x} dx$
\\section{Algorithm \\& Graphics}
\\begin{algorithm}
\\caption{Test}
\\begin{algorithmic}
\\State $y \\gets 42$
\\end{algorithmic}
\\end{algorithm}
\\begin{tikzpicture}
\\draw (0,0) -- (1,1);
\\end{tikzpicture}
\\end{document}`;

  const texFile = path.join(tempWarmupDir, 'offline_warmup.tex');
  fs.writeFileSync(texFile, warmupDoc, 'utf-8');

  try {
    // 1. Initial compilation to download and cache everything
    await runTectonic([texFile, '--outdir', tempWarmupDir, '--chatter', 'minimal'], tempWarmupDir);
    console.log('✅ Standard packages cached successfully!');

    // 2. Offline verification run using --only-cached
    console.log('\n🧪 Testing OFFLINE mode with --only-cached flag...');
    await runTectonic(['--only-cached', texFile, '--outdir', tempWarmupDir, '--chatter', 'minimal'], tempWarmupDir);
    console.log('🎉 Offline verification passed! Tectonic compiled without any network connection.');
  } finally {
    fs.rmSync(tempWarmupDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log('====================================================');
  console.log('  LaTeX to PDF Server - Offline Setup');
  console.log('====================================================');

  try {
    await ensureTectonicInstalled();
    await prewarmOfflineCache();

    console.log('\n====================================================');
    console.log('✅ OFFLINE SETUP COMPLETE!');
    console.log('====================================================');
    console.log('You can now run this server completely offline!');
    console.log('\nTo start the server:');
    console.log('   npm start');
    console.log('\nTo force offline mode in .env:');
    console.log('   OFFLINE_MODE=true');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
  }
}

main();
