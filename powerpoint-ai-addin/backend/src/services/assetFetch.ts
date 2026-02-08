import path from 'node:path';
import fs from 'node:fs/promises';

const cacheDir = path.resolve(process.cwd(), 'assets-cache');

const guessExt = (contentType: string | null): string => {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  return 'jpg';
};

export const fetchImageAsDataUri = async (downloadUrl: string): Promise<{
  contentType: string;
  dataUri: string;
  filePath: string;
}> => {
  const r = await fetch(downloadUrl);
  if (!r.ok) throw new Error(`Asset download failed: ${r.status}`);

  const contentType = r.headers.get('content-type') ?? 'image/jpeg';
  const buf = Buffer.from(await r.arrayBuffer());
  const base64 = buf.toString('base64');

  await fs.mkdir(cacheDir, { recursive: true });
  const ext = guessExt(contentType);
  const assetId = `asset-${Date.now()}`;
  const filePath = path.join(cacheDir, `${assetId}.${ext}`);
  await fs.writeFile(filePath, buf);

  return {
    contentType,
    dataUri: `data:${contentType};base64,${base64}`,
    filePath
  };
};
