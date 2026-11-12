import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import compileRouter from './routes/compile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse incoming request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/plain', 'application/x-latex'], limit: '10mb' }));

// Serve static frontend UI from public/
app.use(express.static(path.join(projectRoot, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: 'tectonic',
    tectonicPath: config.tectonicPath,
    offlineMode: config.offlineMode,
    timestamp: new Date().toISOString()
  });
});

// Compilation endpoints
app.use('/api/compile', compileRouter);

// Root fallback (if not handled by public static)
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'public', 'index.html'));
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Request error:', err.message);

  const statusCode = err.status || (err.exitCode !== undefined ? 422 : 500);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected error occurred during processing',
    logs: err.logs || null
  });
});

// Check if this module is being run directly as main entry point
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

// Start listening if run directly and not in test environment
if (isDirectRun && process.env.NODE_ENV !== 'test') {
  app.listen(config.port, config.host, () => {
    console.log(`====================================================`);
    console.log(` LaTeX to PDF Server is running!`);
    console.log(` Web UI:    http://localhost:${config.port}`);
    console.log(` Health:    http://localhost:${config.port}/api/health`);
    console.log(` Endpoints:`);
    console.log(`   - POST /api/compile/pdf    (returns PDF directly)`);
    console.log(`   - POST /api/compile/bundle (returns ZIP with PDF + TeX)`);
    console.log(`   - POST /api/compile        (?format=pdf|zip|json)`);
    console.log(` Compiler:  ${config.tectonicPath}`);
    console.log(`====================================================`);
  });
}

export default app;
