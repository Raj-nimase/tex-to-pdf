# LaTeX to PDF Compiler Server

A fast, lightweight, and modern Node.js server powered by the **Tectonic** typesetting engine. It converts LaTeX documents into publication-ready PDFs with 100% formatting fidelity and provides endpoints to return either the compiled PDF directly or a bundle containing both the generated PDF and the original `.tex` source code.

---

## ⚡ Features

- **Blazing Fast LaTeX Compilation**: Powered by **Tectonic** (modern XeTeX engine with automatic font and package resolution from CTAN on demand—no 5GB TeX Live install needed).
- **Multiple Output Formats**:
  - `POST /api/compile/pdf`: Directly stream the compiled PDF binary (`application/pdf`).
  - `POST /api/compile/bundle`: Returns a ZIP archive (`application/zip`) containing both `document.pdf` and the source `document.tex`.
  - `POST /api/compile`: Universal endpoint with query parameter `?format=pdf|zip|json`.
- **Flexible Input**:
  - Accepts raw LaTeX code via JSON: `{ "latex": "\\documentclass{...}" }`
  - Accepts raw `.tex` file uploads via `multipart/form-data` (`file` field).
  - Accepts `text/plain` or `application/x-latex` raw request body.
- **Concurrency & Isolation**: Each compilation runs in a dedicated temporary UUID directory and is cleaned up immediately upon completion.
- **Built-in Web Testing Dashboard**: Includes an interactive frontend UI with live LaTeX templates (Math formulas, Academic Papers, Resumes) and an instant PDF previewer.
- **Timeout & Error Diagnostics**: Configurable timeout (default 30s) and clean extraction of LaTeX error logs if compilation fails.

---

## 🚀 Quick Start

### 1. Start the Server

```bash
npm start
```

Or for automatic reloading during development:

```bash
npm run dev
```

The server will be available at **`http://localhost:3000`**.

### 2. Run Automated Tests

```bash
npm test
```

---

## 📡 API Reference

### 1. Compile to PDF (Binary Stream)

**Endpoint:** `POST /api/compile/pdf`  
**Description:** Compiles the LaTeX input and streams the resulting PDF directly.

#### Option A: JSON Body
```bash
curl -X POST http://localhost:3000/api/compile/pdf \
  -H "Content-Type: application/json" \
  -d '{
    "latex": "\\documentclass{article}\\begin{document}\\section{Hello}This is a test PDF!\\end{document}"
  }' \
  --output document.pdf
```

#### Option B: Upload `.tex` File
```bash
curl -X POST http://localhost:3000/api/compile/pdf \
  -F "file=@my_paper.tex" \
  --output document.pdf
```

---

### 2. Upload `.tex` and Return Both TeX + PDF Bundle

**Endpoints:** `POST /api/compile/bundle` or `POST /api/compile/tex-pdf` (or `POST /api/compile?format=zip`)  
**Description:** Receives your `.tex` file, compiles it, and returns an archive containing **both** the generated `.pdf` and the `.tex` source file.

```bash
# Upload report.tex -> receives report-bundle.zip containing report.pdf & report.tex
curl -X POST http://localhost:3000/api/compile/bundle \
  -F "file=@report.tex" \
  --output report-bundle.zip
```

---

### 3. Universal Endpoint

**Endpoint:** `POST /api/compile`  
**Query Parameters:**
- `format=pdf` (default): Returns binary PDF.
- `format=zip` or `format=bundle`: Returns ZIP archive.
- `format=json`: Returns JSON response with base64 PDF and compilation metadata:

```bash
curl -X POST "http://localhost:3000/api/compile?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "latex": "\\documentclass{article}\\begin{document}Testing\\end{document}"
  }'
```

**JSON Response Format:**
```json
{
  "success": true,
  "durationMs": 340,
  "filename": "document.pdf",
  "latex": "\\documentclass{article}\\begin{document}Testing\\end{document}",
  "pdfBase64": "JVBERi0xLjUKMSAwIG9ia...",
  "logs": "Running TeX..."
}
```

---

### 4. Health Check

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "engine": "tectonic",
  "tectonicPath": "c:\\...\\bin\\tectonic.exe",
  "timestamp": "2026-10-31T15:20:00.000Z"
}
```

---

## 🛠️ Code Examples

### Node.js / JavaScript (Fetch)

```javascript
const response = await fetch('http://localhost:3000/api/compile/pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    latex: `\\documentclass{article}
\\begin{document}
\\section{Dynamic Compilation}
Rendered via Node.js fetch!
\\end{document}`
  })
});

if (response.ok) {
  const blob = await response.blob();
  const pdfUrl = URL.createObjectURL(blob);
  window.open(pdfUrl);
}
```

### Python (`requests`)

```python
import requests

latex_source = r"""
\documentclass{article}
\begin{document}
\title{Automated Report}
\author{Python Client}
\maketitle
\section{Results}
$E = mc^2$
\end{document}
"""

# Compile to PDF
response = requests.post(
    "http://localhost:3000/api/compile/pdf",
    json={"latex": latex_source}
)

with open("output.pdf", "wb") as f:
    f.write(response.content)

# Or compile to ZIP bundle containing both PDF and LaTeX
bundle_response = requests.post(
    "http://localhost:3000/api/compile/bundle",
    json={"latex": latex_source}
)

with open("output-bundle.zip", "wb") as f:
    f.write(bundle_response.content)
```

---

## ☁️ Deploying to Render

You can deploy this server to [Render.com](https://render.com) using either **Native Node.js** or **Docker**.

### Method 1: Native Node.js Web Service (Recommended)

1. Push this repository to GitHub or GitLab.
2. Go to your **Render Dashboard** and click **New +** > **Web Service**.
3. Select your repository.
4. Set the following options:
   - **Environment:** `Node`
   - **Build Command:** `bash render-build.sh` (or `npm run build`)
   - **Start Command:** `node src/server.js` (or `npm start`)
5. Click **Create Web Service**.

> The included `render-build.sh` script automatically downloads the prebuilt, statically linked Linux binary of Tectonic into `./bin/tectonic` and pre-warms the LaTeX format cache during build.

---

### Method 2: Docker Web Service

1. Create a **New Web Service** on Render.
2. Connect your repository.
3. Render will automatically detect the included [`Dockerfile`](file:///Dockerfile).
4. Click **Deploy**. Everything (Node.js, Tectonic engine, Linux fonts) is containerized and ready.
