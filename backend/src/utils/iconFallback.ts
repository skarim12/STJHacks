import sharp from "sharp";

function clamp(s: string, max: number): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

function normHex(h: any, fallback: string): string {
  const s = String(h || "").trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

function simpleHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) >>> 0;
}

function pick<T>(seed: string, arr: T[]): T {
  const h = simpleHash(seed);
  return arr[h % arr.length];
}

function tint(hex: string, amount: number): string {
  // mix with white
  const h = String(hex).replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const t = Math.max(0, Math.min(1, amount));
  const m = (x: number) => Math.round(x * (1 - t) + 255 * t);
  return `#${m(r).toString(16).padStart(2, "0")}${m(g).toString(16).padStart(2, "0")}${m(b).toString(16).padStart(2, "0")}`;
}

export async function generateIconTileDataUri(opts: {
  deckTitle?: string;
  slideIndex: number;
  slideTitle?: string;
  accent?: string;
  secondary?: string;
  background?: string;
}): Promise<{ dataUri: string; credit: string }> {
  const deckTitle = String(opts.deckTitle || "");
  const slideTitle = clamp(String(opts.slideTitle || ""), 60);

  const accent = normHex(opts.accent, "#6ee7ff");
  const secondary = normHex(opts.secondary, "#a78bfa");
  const bg = normHex(opts.background, "#0b1220");

  const seed = `${deckTitle}|${opts.slideIndex}|${slideTitle}`;
  const motif = pick(seed + "|motif", ["rings", "bars", "nodes", "corner"] as const);
  const a = accent;
  const b = secondary;
  const a10 = tint(a, 0.85);
  const b10 = tint(b, 0.85);

  // 16:9 tile at 1600x900 (PPT-friendly). Keep it simple and clean.
  const w = 1600;
  const h = 900;

  const svg = (() => {
    const defs = `
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${a}" stop-opacity="0.95"/>
          <stop offset="1" stop-color="${b}" stop-opacity="0.95"/>
        </linearGradient>
      </defs>`;

    const base = `<rect x="0" y="0" width="${w}" height="${h}" rx="28" ry="28" fill="${tint(bg, 0.92)}"/>`;

    const centerX = 520;
    const centerY = 450;

    const title = slideTitle
      ? `<text x="860" y="470" font-family="Segoe UI, Arial" font-size="44" fill="#0b1220" font-weight="700">${escapeXml(
          slideTitle
        )}</text>`
      : "";

    const subtitle = `<text x="860" y="520" font-family="Segoe UI, Arial" font-size="22" fill="#111827" opacity="0.65">Visual placeholder</text>`;

    const panel = `<rect x="780" y="340" width="720" height="280" rx="22" ry="22" fill="#ffffff" opacity="0.92"/>`;

    const shape = (() => {
      if (motif === "rings") {
        return `
          <circle cx="${centerX}" cy="${centerY}" r="180" fill="none" stroke="url(#g)" stroke-width="26" opacity="0.95"/>
          <circle cx="${centerX}" cy="${centerY}" r="110" fill="none" stroke="${a10}" stroke-width="18" opacity="0.9"/>
          <circle cx="${centerX + 130}" cy="${centerY - 120}" r="22" fill="${b}" opacity="0.95"/>
        `;
      }
      if (motif === "bars") {
        return `
          <rect x="${centerX - 220}" y="${centerY - 160}" width="90" height="360" rx="16" fill="${a}" opacity="0.9"/>
          <rect x="${centerX - 100}" y="${centerY - 90}" width="90" height="290" rx="16" fill="${b}" opacity="0.9"/>
          <rect x="${centerX + 20}" y="${centerY - 40}" width="90" height="240" rx="16" fill="${a10}" opacity="0.95"/>
        `;
      }
      if (motif === "nodes") {
        return `
          <circle cx="${centerX - 160}" cy="${centerY}" r="26" fill="${a}"/>
          <circle cx="${centerX}" cy="${centerY - 120}" r="26" fill="${b}"/>
          <circle cx="${centerX + 160}" cy="${centerY}" r="26" fill="${a10}"/>
          <circle cx="${centerX}" cy="${centerY + 140}" r="26" fill="${b10}"/>
          <line x1="${centerX - 160}" y1="${centerY}" x2="${centerX}" y2="${centerY - 120}" stroke="${tint(a, 0.6)}" stroke-width="10" opacity="0.8"/>
          <line x1="${centerX}" y1="${centerY - 120}" x2="${centerX + 160}" y2="${centerY}" stroke="${tint(b, 0.6)}" stroke-width="10" opacity="0.8"/>
          <line x1="${centerX + 160}" y1="${centerY}" x2="${centerX}" y2="${centerY + 140}" stroke="${tint(a, 0.6)}" stroke-width="10" opacity="0.8"/>
          <line x1="${centerX}" y1="${centerY + 140}" x2="${centerX - 160}" y2="${centerY}" stroke="${tint(b, 0.6)}" stroke-width="10" opacity="0.8"/>
        `;
      }
      // corner
      return `
        <path d="M${centerX - 240},${centerY - 210} L${centerX + 200},${centerY - 210} Q${centerX + 260},${centerY - 210} ${centerX + 260},${centerY - 150} L${centerX + 260},${centerY + 210} L${centerX - 240},${centerY + 210} Z" fill="${tint(a, 0.88)}" opacity="0.95"/>
        <path d="M${centerX - 240},${centerY - 210} L${centerX + 40},${centerY - 210} L${centerX - 240},${centerY + 60} Z" fill="${tint(b, 0.82)}" opacity="0.95"/>
        <rect x="${centerX - 220}" y="${centerY - 190}" width="420" height="380" rx="26" fill="url(#g)" opacity="0.35"/>
      `;
    })();

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${defs}
${base}
${shape}
${panel}
${title}
${subtitle}
</svg>`;
  })();

  const png = await sharp(Buffer.from(svg, "utf8"))
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    dataUri: `data:image/png;base64,${png.toString("base64")}`,
    credit: "Generated icon tile (deterministic)",
  };
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
