import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { findSoffice, convertPptxToPdf } from '../services/soffice.js';

export const uploadRouter = Router();

const uploadsDir = path.resolve(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (e: any) {
      cb(e, uploadsDir);
    }
  },
  filename: (_req, file, cb) => {
    const safe = (file.originalname || 'upload.pptx').replace(/[^a-z0-9._-]/gi, '_');
    const stamp = Date.now();
    cb(null, `${stamp}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB
});

// Upload a PPTX and (best-effort) convert to PDF for in-browser viewing.
// POST /api/upload/pptx (multipart/form-data with field: file)
uploadRouter.post('/pptx', upload.single('file'), async (req, res) => {
  const f = (req as any).file as Express.Multer.File | undefined;
  if (!f) return res.status(400).json({ success: false, error: 'Missing file (field name: file)' });

  const pptxPath = f.path;
  const id = path.basename(pptxPath);

  const pptxUrl = `/uploads/${encodeURIComponent(id)}`;

  let pdfUrl: string | null = null;
  const warnings: string[] = [];

  try {
    const soffice = await findSoffice();
    if (!soffice) {
      warnings.push('LibreOffice (soffice) not found; cannot convert to PDF for viewing. Set SOFFICE_PATH or install LibreOffice.');
    } else {
      const outDir = uploadsDir;
      const { pdfPath } = await convertPptxToPdf({ sofficePath: soffice, pptxPath, outDir });
      const pdfId = path.basename(pdfPath);
      pdfUrl = `/uploads/${encodeURIComponent(pdfId)}`;
    }
  } catch (e: any) {
    warnings.push(`Conversion failed: ${e?.message ?? String(e)}`);
  }

  return res.json({
    success: true,
    id,
    pptxUrl,
    pdfUrl,
    warnings: warnings.length ? warnings : undefined
  });
});
