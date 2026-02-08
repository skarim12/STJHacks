import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import { apiRouter } from './routes/api.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve uploaded files (pptx + optional pdf preview)
const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/api', apiRouter);

const port = Number(process.env.PORT ?? 3000);
const useHttps = String(process.env.USE_HTTPS ?? '').toLowerCase() === 'true';

// Default Office dev-certs location on Windows/macOS.
const defaultCertDir = path.join(process.env.USERPROFILE || process.env.HOME || '', '.office-addin-dev-certs');
const certPath = process.env.SSL_CERT_PATH || path.join(defaultCertDir, 'localhost.crt');
const keyPath = process.env.SSL_KEY_PATH || path.join(defaultCertDir, 'localhost.key');

if (useHttps) {
  const certExists = fs.existsSync(certPath);
  const keyExists = fs.existsSync(keyPath);
  if (certExists && keyExists) {
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    https.createServer({ cert, key }, app).listen(port, () => {
      console.log(`backend listening on https://localhost:${port}`);
    });
  } else {
    console.warn(
      `USE_HTTPS=true but cert/key not found. cert=${certPath} key=${keyPath}. Falling back to http.`
    );
    http.createServer(app).listen(port, () => {
      console.log(`backend listening on http://localhost:${port}`);
    });
  }
} else {
  http.createServer(app).listen(port, () => {
    console.log(`backend listening on http://localhost:${port}`);
  });
}
