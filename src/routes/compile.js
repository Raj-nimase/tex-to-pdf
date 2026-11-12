import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import path from 'path';
import { compileLatexToPdf } from '../compiler.js';
import { config } from '../config.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSizeBytes
  }
});

/**
 * Helper to extract LaTeX content from request:
 * Supports:
 * 1. multipart/form-data with file upload ('file' or 'latex_file' or 'tex')
 * 2. application/json body: { latex: "..." } or { code: "..." }
 * 3. raw text / x-latex / text/plain body
 */
function extractLatexSource(req) {
  // If file was uploaded via multer
  if (req.file && req.file.buffer) {
    return req.file.buffer.toString('utf-8');
  }

  // If parsed JSON body
  if (req.body) {
    if (typeof req.body.latex === 'string' && req.body.latex.trim().length > 0) {
      return req.body.latex;
    }
    if (typeof req.body.code === 'string' && req.body.code.trim().length > 0) {
      return req.body.code;
    }
    if (typeof req.body.source === 'string' && req.body.source.trim().length > 0) {
      return req.body.source;
    }
    // If body itself is string (text/plain)
    if (typeof req.body === 'string' && req.body.trim().length > 0) {
      return req.body;
    }
  }

  return null;
}

function getBaseName(req) {
  if (req.query.filename) {
    return req.query.filename.replace(/\.te?x$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  if (req.file && req.file.originalname) {
    const parsed = path.parse(req.file.originalname);
    return parsed.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  if (req.body && typeof req.body.filename === 'string') {
    return req.body.filename.replace(/\.te?x$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  return 'document';
}

/**
 * POST /api/compile/pdf
 * Takes LaTeX source (via file upload or JSON body) and returns the generated PDF.
 */
router.post('/pdf', upload.single('file'), async (req, res, next) => {
  try {
    const latexSource = extractLatexSource(req);
    if (!latexSource) {
      return res.status(400).json({
        success: false,
        error: 'Missing LaTeX content. Provide a .tex file via multipart/form-data ("file") or JSON { "latex": "..." }.'
      });
    }

    const isOffline = req.query.offline === 'true' || (req.body && (req.body.offline === true || req.body.offline === 'true'));
    const result = await compileLatexToPdf(latexSource, { offline: isOffline });
    const baseName = getBaseName(req);
    const filename = `${baseName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Compilation-Time-Ms', result.durationMs.toString());
    res.send(result.pdfBuffer);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/compile/bundle (or /zip)
 * Takes a LaTeX .tex file (or JSON) and returns a ZIP archive containing BOTH the generated PDF and the .tex file.
 */
async function handleBundleRequest(req, res, next) {
  try {
    const latexSource = extractLatexSource(req);
    if (!latexSource) {
      return res.status(400).json({
        success: false,
        error: 'Missing LaTeX content. Provide a .tex file via multipart/form-data ("file") or JSON { "latex": "..." }.'
      });
    }

    const isOffline = req.query.offline === 'true' || (req.body && (req.body.offline === true || req.body.offline === 'true'));
    const result = await compileLatexToPdf(latexSource, { offline: isOffline });
    const baseName = getBaseName(req);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}-bundle.zip"`);
    res.setHeader('X-Compilation-Time-Ms', result.durationMs.toString());

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (archErr) => {
      console.error('Archive error:', archErr);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to create zip bundle' });
      }
    });

    archive.pipe(res);

    // Append both the generated PDF and the LaTeX source file
    archive.append(result.pdfBuffer, { name: `${baseName}.pdf` });
    archive.append(latexSource, { name: `${baseName}.tex` });

    await archive.finalize();
  } catch (err) {
    next(err);
  }
}

router.post('/bundle', upload.single('file'), handleBundleRequest);
router.post('/zip', upload.single('file'), handleBundleRequest);
router.post('/tex-pdf', upload.single('file'), handleBundleRequest);

/**
 * POST /api/compile
 * Universal endpoint supporting format selection:
 * - ?format=pdf (default): returns application/pdf
 * - ?format=zip or ?format=bundle: returns application/zip containing PDF + LaTeX
 * - ?format=json: returns JSON with base64 PDF, LaTeX source, logs, and timing
 */
router.post('/', upload.single('file'), async (req, res, next) => {
  const format = (req.query.format || (req.body && req.body.format) || 'pdf').toLowerCase();

  if (format === 'zip' || format === 'bundle') {
    return handleBundleRequest(req, res, next);
  }

  try {
    const latexSource = extractLatexSource(req);
    if (!latexSource) {
      return res.status(400).json({
        success: false,
        error: 'Missing LaTeX content. Provide a .tex file via multipart/form-data ("file") or JSON { "latex": "..." }.'
      });
    }

    const isOffline = req.query.offline === 'true' || (req.body && (req.body.offline === true || req.body.offline === 'true'));
    const result = await compileLatexToPdf(latexSource, { offline: isOffline });
    const baseName = getBaseName(req);

    if (format === 'json') {
      return res.json({
        success: true,
        durationMs: result.durationMs,
        logs: result.logs,
        baseName: baseName,
        texFilename: `${baseName}.tex`,
        pdfFilename: `${baseName}.pdf`,
        latex: result.latexSource,
        pdfBase64: result.pdfBuffer.toString('base64')
      });
    }

    // Default: Return PDF directly
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${baseName}.pdf"`);
    res.setHeader('X-Compilation-Time-Ms', result.durationMs.toString());
    res.send(result.pdfBuffer);
  } catch (err) {
    next(err);
  }
});

export default router;
