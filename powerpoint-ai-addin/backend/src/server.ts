import express from 'express';
import cors from 'cors';
import path from 'node:path';
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
app.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
