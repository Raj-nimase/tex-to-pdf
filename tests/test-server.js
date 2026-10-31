process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import app from '../src/server.js';
import { config } from '../src/config.js';

const TEST_PORT = 3099;
let server;

function makeRequest({ path, method = 'POST', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            buffer,
            text: () => buffer.toString('utf-8'),
            json: () => JSON.parse(buffer.toString('utf-8'))
          });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

// Simple multipart form data builder for Node test without extra libraries
function buildMultipartFormData(boundary, fields, files) {
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${val}\r\n`
    );
  }

  for (const [key, file] of Object.entries(files)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`
    );
    parts.push(file.content);
    parts.push('\r\n');
  }

  parts.push(`--${boundary}--\r\n`);

  return Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)));
}

async function runTests() {
  console.log('🚀 Starting LaTeX to PDF Compiler Server Tests...\n');

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  try {
    // 1. Health check test
    console.log('Test 1: GET /api/health');
    const healthRes = await makeRequest({ path: '/api/health', method: 'GET' });
    assert.strictEqual(healthRes.statusCode, 200);
    const healthJson = healthRes.json();
    assert.strictEqual(healthJson.status, 'ok');
    assert.strictEqual(healthJson.engine, 'tectonic');
    console.log('   ✅ Health check passed\n');

    // 2. Compile to PDF (JSON payload)
    console.log('Test 2: POST /api/compile/pdf (JSON latex payload)');
    const pdfRes = await makeRequest({
      path: '/api/compile/pdf',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        latex: '\\documentclass{article}\\begin{document}\\section{Integration Test}Hello world from automated test!\\end{document}'
      }
    });

    assert.strictEqual(pdfRes.statusCode, 200, `Expected 200, got ${pdfRes.statusCode}: ${pdfRes.text()}`);
    assert.strictEqual(pdfRes.headers['content-type'], 'application/pdf');
    // Check PDF magic bytes "%PDF-"
    const pdfMagic = pdfRes.buffer.subarray(0, 5).toString('ascii');
    assert.strictEqual(pdfMagic, '%PDF-', 'Output should have valid PDF signature');
    console.log(`   ✅ PDF generated successfully (${pdfRes.buffer.length} bytes, time: ${pdfRes.headers['x-compilation-time-ms']}ms)\n`);

    // 3. Compile to Bundle ZIP (PDF + LaTeX)
    console.log('Test 3: POST /api/compile/bundle (ZIP bundle with PDF + TeX)');
    const bundleRes = await makeRequest({
      path: '/api/compile/bundle',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        latex: '\\documentclass{article}\\begin{document}Testing bundle generation\\end{document}'
      }
    });

    assert.strictEqual(bundleRes.statusCode, 200, `Expected 200, got ${bundleRes.statusCode}`);
    assert.strictEqual(bundleRes.headers['content-type'], 'application/zip');
    // Check ZIP magic bytes "PK\x03\x04"
    const zipMagic = bundleRes.buffer.subarray(0, 2).toString('ascii');
    assert.strictEqual(zipMagic, 'PK', 'Output should have valid ZIP signature');
    console.log(`   ✅ ZIP bundle generated successfully (${bundleRes.buffer.length} bytes)\n`);

    // 4. Universal endpoint with format=json
    console.log('Test 4: POST /api/compile?format=json');
    const jsonRes = await makeRequest({
      path: '/api/compile?format=json',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        latex: '\\documentclass{article}\\begin{document}Universal JSON format test\\end{document}'
      }
    });

    assert.strictEqual(jsonRes.statusCode, 200);
    const jsonBody = jsonRes.json();
    assert.strictEqual(jsonBody.success, true);
    assert.ok(jsonBody.pdfBase64 && jsonBody.pdfBase64.length > 50);
    assert.ok(jsonBody.durationMs >= 0);
    console.log(`   ✅ JSON format returned valid base64 PDF (${jsonBody.pdfBase64.length} chars)\n`);

    // 5. Compile via multipart/form-data file upload
    console.log('Test 5: POST /api/compile/pdf (Multipart file upload)');
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const sampleTex = '\\documentclass{article}\\begin{document}Multipart upload works!\\end{document}';
    const multipartBody = buildMultipartFormData(
      boundary,
      {},
      {
        file: {
          filename: 'test-upload.tex',
          contentType: 'application/x-latex',
          content: Buffer.from(sampleTex, 'utf-8')
        }
      }
    );

    const uploadRes = await makeRequest({
      path: '/api/compile/pdf',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length
      },
      body: multipartBody
    });

    assert.strictEqual(uploadRes.statusCode, 200, `Expected 200, got ${uploadRes.statusCode}: ${uploadRes.text()}`);
    assert.strictEqual(uploadRes.headers['content-type'], 'application/pdf');
    console.log(`   ✅ File upload compilation succeeded (${uploadRes.buffer.length} bytes)\n`);

    // 6. Error handling test with syntax error
    console.log('Test 6: POST /api/compile/pdf (Invalid LaTeX syntax error handling)');
    const errorRes = await makeRequest({
      path: '/api/compile/pdf',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        latex: '\\documentclass{article}\\begin{document}\\undefinedcommand{123}' // deliberately broken
      }
    });

    assert.ok(errorRes.statusCode === 422 || errorRes.statusCode === 400 || errorRes.statusCode === 500);
    const errorJson = errorRes.json();
    assert.strictEqual(errorJson.success, false);
    assert.ok(errorJson.error, 'Error message should be present');
    console.log(`   ✅ Graceful error response received: "${errorJson.error.slice(0, 80)}..."\n`);

    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! The server is fully functional.');
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Test suite failed:', err);
  if (server) server.close();
  process.exit(1);
});
