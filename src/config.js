import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Find tectonic binary: check project bin first, then environment variable, then fallback to 'tectonic'
function resolveTectonicPath() {
  const localBin = path.join(projectRoot, 'bin', process.platform === 'win32' ? 'tectonic.exe' : 'tectonic');
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  if (process.env.TECTONIC_PATH && fs.existsSync(process.env.TECTONIC_PATH)) {
    return process.env.TECTONIC_PATH;
  }
  return 'tectonic';
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  tectonicPath: resolveTectonicPath(),
  tempDir: path.resolve(process.env.TEMP_DIR || path.join(projectRoot, 'temp')),
  compilationTimeoutMs: parseInt(process.env.COMPILATION_TIMEOUT_MS || '30000', 10),
  maxUploadSizeBytes: parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '10485760', 10) // 10MB default
};
