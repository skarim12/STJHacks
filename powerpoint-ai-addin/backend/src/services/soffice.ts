import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function findSoffice(): Promise<string | null> {
  const env = String(process.env.SOFFICE_PATH ?? '').trim();
  if (env && (await exists(env))) return env;

  // Common Windows install locations
  const candidates = [
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'
  ];

  for (const c of candidates) {
    if (await exists(c)) return c;
  }

  return null;
}

export async function convertPptxToPdf(opts: {
  sofficePath: string;
  pptxPath: string;
  outDir: string;
}): Promise<{ pdfPath: string }> {
  // LibreOffice writes output into outDir with the same base name
  await fs.mkdir(opts.outDir, { recursive: true });

  await execFileAsync(opts.sofficePath, [
    '--headless',
    '--nologo',
    '--nolockcheck',
    '--norestore',
    '--convert-to',
    'pdf',
    '--outdir',
    opts.outDir,
    opts.pptxPath
  ]);

  const base = path.basename(opts.pptxPath, path.extname(opts.pptxPath));
  const pdfPath = path.join(opts.outDir, `${base}.pdf`);
  if (!(await exists(pdfPath))) {
    throw new Error('LibreOffice conversion did not produce a PDF');
  }

  return { pdfPath };
}
