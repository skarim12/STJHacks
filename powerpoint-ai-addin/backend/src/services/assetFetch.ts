import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const cacheDir = path.resolve(process.cwd(), 'assets-cache');

const guessExt = (contentType: string | null): string => {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  return 'jpg';
};

async function normalizeImageBestEffort(buf: Buffer, contentType: string): Promise<{ buf: Buffer; contentType: string }> {
  // Full normalization (resize/convert) greatly improves PPT reliability.
  // Best-effort: if sharp fails to load, fall back to original buffer.
  try {
    const sharpMod = await import('sharp');
    const sharp = (sharpMod as any).default ?? (sharpMod as any);

    // Resize inside max bounds to keep base64 payload reasonable.
    const MAX_EDGE = 1600;

    // Convert to JPEG to reduce size (good enough for photos).
    // For diagrams/icons we'd want PNG, but those assets are generated separately.
    const out = await sharp(buf)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return { buf: out, contentType: 'image/jpeg' };
  } catch {
    return { buf, contentType };
  }
}

export const fetchImageAsDataUri = async (downloadUrl: string): Promise<{
  contentType: string;
  dataUri: string;
  filePath: string;
}> => {
  const r = await fetch(downloadUrl);
  if (!r.ok) throw new Error(`Asset download failed: ${r.status}`);

  const contentTypeIn = r.headers.get('content-type') ?? 'image/jpeg';
  const bufIn = Buffer.from(await r.arrayBuffer());

  // Normalize (resize/convert) to improve PPT/Office insertion reliability.
  const norm = await normalizeImageBestEffort(bufIn, contentTypeIn);
  const contentType = norm.contentType;
  const buf = norm.buf;

  // Office.js addImage is sensitive to very large base64 payloads.
  // Keep a conservative cap here so auto-selection doesn't silently produce decks that can't be inserted.
  const MAX_BYTES = 4.5 * 1024 * 1024; // ~4.5MB
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(
      `Normalized image too large (${Math.round(buf.byteLength / 1024)}KB). Prefer a smaller rendition URL.`
    );
  }

  const base64 = buf.toString('base64');

  await fs.mkdir(cacheDir, { recursive: true });
  const ext = guessExt(contentType);

  // Content-hash caching: dedupe identical downloads across runs.
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
  const filePath = path.join(cacheDir, `asset-${hash}.${ext}`);

  try {
    // Only write if missing.
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, buf);
  }

  return {
    contentType,
    dataUri: `data:${contentType};base64,${base64}`,
    filePath
  };
};
