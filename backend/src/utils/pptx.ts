import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { getVariantByName, type LayoutVariant } from "./layoutVariants";

function hexOrDefault(h: any, fallback: string): string {
  const s = String(h || "").trim();
  return /^#?[0-9a-f]{6}$/i.test(s) ? (s.startsWith("#") ? s : `#${s}`) : fallback;
}

function pptxColor(hex: string): string {
  return String(hex).replace(/^#/, "").toUpperCase();
}

function parseDataUri(dataUri: string): { mime: string; buf: Buffer } | null {
  const m = String(dataUri || "").match(/^data:([^;]+);base64,(.+)$/i);
  if (!m) return null;
  try {
    return { mime: String(m[1]).toLowerCase(), buf: Buffer.from(String(m[2]), "base64") };
  } catch {
    return null;
  }
}

async function normalizeImageForPptx(dataUri: string): Promise<string | null> {
  // pptxgenjs *usually* accepts data URIs, but in practice some JPEG/WebP variants fail.
  // Normalize deterministically to JPEG, resized, to improve reliability.
  const parsed = parseDataUri(dataUri);
  if (!parsed?.buf?.length) return null;

  try {
    const out = await sharp(parsed.buf)
      .rotate()
      .resize({ width: 1800, withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * PPTX export with theming + images + variant-aware layout.
 * Deterministic: relies on layoutPlan.variant + stylePlan.
 */
export async function buildPptxBuffer(outline: any): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const scheme = outline?.colorScheme || {};
  const bg = hexOrDefault(scheme.background, "#0B1220");
  const text = hexOrDefault(scheme.text, "#FFFFFF");
  const accent = hexOrDefault(scheme.accent || scheme.primary, "#0078D4");
  const secondary = hexOrDefault(scheme.secondary, "#A78BFA");

  const themeStyle = outline?.themeStyle || {};
  const panelsKind = String(themeStyle?.panels || "glass");

  // Panel "card" styling (PPT-friendly approximation of HTML cards).
  const panelFill = panelsKind === "flat" ? "FFFFFF" : pptxColor("#FFFFFF");
  const panelTransparency = panelsKind === "flat" ? 6 : 18; // glass -> more transparent
  const panelRadius = 10;

  const SLIDE_W = 13.33;
  const SLIDE_H = 7.5;

  // Approximate the HTML safe margins.
  const SAFE_X = 0.85;
  const SAFE_Y = 0.65;
  const SAFE_W = SLIDE_W - 2 * SAFE_X;
  const SAFE_H = SLIDE_H - 2 * SAFE_Y;

  const rectToBox = (rect: { colStart: number; colSpan: number; rowStart: number; rowSpan: number }) => {
    const x = SAFE_X + ((rect.colStart - 1) / 12) * SAFE_W;
    const w = (rect.colSpan / 12) * SAFE_W;
    const y = SAFE_Y + ((rect.rowStart - 1) / 8) * SAFE_H;
    const h = (rect.rowSpan / 8) * SAFE_H;
    const pad = 0.08;
    return { x: x + pad, y: y + pad, w: Math.max(0.2, w - 2 * pad), h: Math.max(0.2, h - 2 * pad) };
  };

  const addCard = (slide: any, box: { x: number; y: number; w: number; h: number }, opts?: { fillHex?: string; transparency?: number; strokeHex?: string }) => {
    const fillHex = opts?.fillHex || panelFill;
    const transparency = typeof opts?.transparency === "number" ? opts.transparency : panelTransparency;
    const strokeHex = opts?.strokeHex || pptxColor(accent);

    slide.addShape(pptx.ShapeType.roundRect, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fill: { color: fillHex, transparency },
      line: { color: strokeHex, transparency: 92 },
      radius: panelRadius,
    });
  };

  const inset = (box: { x: number; y: number; w: number; h: number }, pad: number) => ({
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(0.2, box.w - pad * 2),
    h: Math.max(0.2, box.h - pad * 2),
  });

  const addBg = (slide: any) => {
    try {
      slide.background = { color: pptxColor(bg) };
    } catch {
      // ignore
    }
  };

  // Title slide
  {
    const slide = pptx.addSlide();
    addBg(slide);

    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: 0.18,
      fill: { color: pptxColor(accent) },
      line: { color: pptxColor(accent) },
    });

    slide.addText(outline?.title || "Untitled Presentation", {
      x: 0.8,
      y: 1.4,
      w: 11.8,
      h: 1,
      fontFace: "Calibri",
      fontSize: 40,
      bold: true,
      color: pptxColor(text),
    });

    if (outline?.overallTheme) {
      slide.addText(String(outline.overallTheme), {
        x: 0.8,
        y: 2.4,
        w: 11.8,
        h: 0.8,
        fontFace: "Calibri",
        fontSize: 20,
        color: pptxColor(text),
      });
    }
  }

  const slides = Array.isArray(outline?.slides) ? outline.slides : [];
  for (const s of slides) {
    const slide = pptx.addSlide();
    addBg(slide);

    const variantName = String(s?.layoutPlan?.variant || "content.singleCard");
    const variant: LayoutVariant | null = getVariantByName(variantName);
    const hasImage = typeof s?.imageDataUri === "string" && s.imageDataUri.startsWith("data:image/");

    const sp = s?.stylePlan || {};
    const titlePlan = sp?.title || {};
    const bodyPlan = sp?.body || {};

    const titleFontFace = String(titlePlan?.fontFace || "Calibri");
    const titleFontSize = Number(titlePlan?.fontSize);
    const titleColor = hexOrDefault(titlePlan?.color, text);

    const bodyFontFace = String(bodyPlan?.fontFace || "Calibri");
    const bodyFontSize = Number(bodyPlan?.fontSize);
    const bodyColor = hexOrDefault(bodyPlan?.color, text);

    const content: string[] = Array.isArray(s?.content) ? s.content : [];

    // Full-bleed background image
    if (variantName === "image.fullBleed" && hasImage) {
      try {
        const normalized = await normalizeImageForPptx(String(s.imageDataUri));
        if (normalized) {
          slide.addImage({ data: normalized, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
          slide.addShape(pptx.ShapeType.rect, {
            x: 0,
            y: 0,
            w: SLIDE_W,
            h: SLIDE_H,
            fill: { color: "000000", transparency: 45 },
            line: { color: "000000", transparency: 100 },
          });
        }
      } catch {
        // If image fails, continue with text-only slide.
      }
    }

    const boxes = (variant?.boxes || []) as any[];
    const fallbackBoxes = [
      { kind: "header", rect: { colStart: 1, colSpan: 12, rowStart: 1, rowSpan: 2 } },
      { kind: "bulletsCard", rect: { colStart: 1, colSpan: 12, rowStart: 3, rowSpan: 6 } },
    ];

    const layoutBoxes = boxes.length ? boxes.filter((b) => b.kind !== "fullBleedImage") : fallbackBoxes;

    // Split bullets across multiple bulletsCard boxes deterministically.
    const bulletCardCount = layoutBoxes.filter((b) => b.kind === "bulletsCard").length;
    const parts: string[][] = (() => {
      const n = Math.max(1, Math.min(3, bulletCardCount || 1));
      const out: string[][] = Array.from({ length: n }, () => []);
      for (let j = 0; j < content.length; j++) out[j % n].push(content[j]);
      return out;
    })();
    let bulletCursor = 0;

    for (const b of layoutBoxes) {
      const kind = String(b.kind);
      const rect = b.rect;
      const box = rectToBox(rect);

      if (kind === "accentBar") {
        slide.addShape(pptx.ShapeType.roundRect, {
          ...box,
          fill: { color: pptxColor(accent) },
          line: { color: pptxColor(accent), transparency: 100 },
        });
        continue;
      }

      if (kind === "header") {
        slide.addText(String(s?.title || ""), {
          x: box.x,
          y: box.y,
          w: box.w,
          h: Math.min(box.h, 1.0),
          fontFace: titleFontFace,
          fontSize: Number.isFinite(titleFontSize) ? Math.max(18, Math.min(48, Math.round(titleFontSize * 0.48))) : 30,
          bold: String(titlePlan?.weight || "bold") === "bold",
          color: pptxColor(titleColor),
        });
        slide.addShape(pptx.ShapeType.rect, {
          x: box.x,
          y: box.y + Math.min(box.h, 1.0) - 0.06,
          w: Math.min(5.5, box.w),
          h: 0.05,
          fill: { color: pptxColor(accent) },
          line: { color: pptxColor(accent) },
        });
        continue;
      }

      if (kind === "imageCard" && hasImage && variantName !== "image.fullBleed") {
        try {
          const normalized = await normalizeImageForPptx(String(s.imageDataUri));
          if (normalized) {
            slide.addImage({ data: normalized, x: box.x, y: box.y, w: box.w, h: box.h });
          }
        } catch {
          // ignore
        }
        continue;
      }

      if (kind === "statementCard") {
        addCard(slide, box, { fillHex: pptxColor(accent), transparency: 70, strokeHex: pptxColor(accent) });
        const inner = inset(box, 0.18);
        const statement = String(content?.[0] || s?.notes || s?.describe || "").trim();
        slide.addText(statement, {
          x: inner.x,
          y: inner.y,
          w: inner.w,
          h: inner.h,
          fontFace: titleFontFace,
          fontSize: 30,
          bold: true,
          color: pptxColor(titleColor),
          valign: "top",
        });
        continue;
      }

      if (kind === "bulletsCard") {
        addCard(slide, box);
        const inner = inset(box, 0.18);
        const p = parts[Math.min(parts.length - 1, bulletCursor++)] || [];
        const bulletText = p.map((c) => `• ${String(c)}`).join("\n");
        slide.addText(bulletText || "", {
          x: inner.x,
          y: inner.y,
          w: inner.w,
          h: inner.h,
          fontFace: bodyFontFace,
          fontSize: Number.isFinite(bodyFontSize) ? Math.max(14, Math.min(26, Math.round(bodyFontSize * 0.40))) : 18,
          color: pptxColor(bodyColor),
          valign: "top",
        });
        continue;
      }

      if (kind === "quoteCard") {
        addCard(slide, box);
        const inner = inset(box, 0.22);
        const quote = String(content?.[0] || "").trim();
        const by = String(content?.[1] || "").trim().replace(/^[\-—]\s*/, "");
        slide.addText(quote ? `“${quote}”` : "", {
          x: inner.x,
          y: inner.y,
          w: inner.w,
          h: Math.max(0.5, inner.h * 0.7),
          fontFace: titleFontFace,
          fontSize: 26,
          italic: true,
          color: pptxColor(titleColor),
          valign: "top",
        });
        if (by) {
          slide.addText(by, {
            x: inner.x,
            y: inner.y + inner.h * 0.72,
            w: inner.w,
            h: inner.h * 0.25,
            fontFace: bodyFontFace,
            fontSize: 16,
            color: pptxColor(bodyColor),
            valign: "top",
          });
        }
        continue;
      }

      if (kind === "comparisonLeft" || kind === "comparisonRight") {
        addCard(slide, box);
        const inner = inset(box, 0.18);
        const half = Math.ceil(content.length / 2);
        const left = content.slice(0, half);
        const right = content.slice(half);
        const items = kind === "comparisonLeft" ? left : right;
        const bulletText = items.map((c) => `• ${String(c)}`).join("\n");
        slide.addText(bulletText, {
          x: inner.x,
          y: inner.y,
          w: inner.w,
          h: inner.h,
          fontFace: bodyFontFace,
          fontSize: 16,
          color: pptxColor(bodyColor),
          valign: "top",
        });
        continue;
      }
    }

    // Decorative shapes (AI-drawn) with basic exclusion (avoid overlapping main boxes too much).
    const shapes = Array.isArray(sp?.shapes) ? sp.shapes : [];
    const exclusions = layoutBoxes
      .filter((b) => b.kind !== "accentBar" && b.kind !== "fullBleedImage")
      .map((b) => {
        const r = b.rect;
        return {
          x: (Math.max(1, Math.min(12, r.colStart)) - 1) / 12,
          y: (Math.max(1, Math.min(8, r.rowStart)) - 1) / 8,
          w: Math.max(1, Math.min(12, r.colSpan)) / 12,
          h: Math.max(1, Math.min(8, r.rowSpan)) / 8,
        };
      });

    const overlaps = (a: any, b: any): number => {
      const ax2 = a.x + a.w;
      const ay2 = a.y + a.h;
      const bx2 = b.x + b.w;
      const by2 = b.y + b.h;
      const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
      const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
      return ix * iy;
    };

    for (const sh of shapes.slice(0, 12)) {
      const kind = String(sh?.kind || "").toLowerCase();
      if (kind === "rect") {
        const rect = {
          x: Math.max(0, Math.min(1, Number(sh?.x ?? 0))),
          y: Math.max(0, Math.min(1, Number(sh?.y ?? 0))),
          w: Math.max(0.02, Math.min(1, Number(sh?.w ?? 0.2))),
          h: Math.max(0.02, Math.min(1, Number(sh?.h ?? 0.1))),
        };
        const area = rect.w * rect.h;
        if (area > 0) {
          let bad = false;
          for (const ex of exclusions) {
            if (overlaps(rect, ex) / area > 0.12) {
              bad = true;
              break;
            }
          }
          if (bad) continue;
        }

        const fill = hexOrDefault(sh?.fill, accent);
        slide.addShape(pptx.ShapeType.roundRect, {
          x: SAFE_X + rect.x * SAFE_W,
          y: SAFE_Y + rect.y * SAFE_H,
          w: rect.w * SAFE_W,
          h: rect.h * SAFE_H,
          fill: { color: pptxColor(fill), transparency: 35 },
          line: { color: pptxColor(fill), transparency: 100 },
        });
      }

      if (kind === "line") {
        const x1 = Math.max(0, Math.min(1, Number(sh?.x1 ?? 0)));
        const y1 = Math.max(0, Math.min(1, Number(sh?.y1 ?? 0)));
        const x2 = Math.max(0, Math.min(1, Number(sh?.x2 ?? 0.4)));
        const y2 = Math.max(0, Math.min(1, Number(sh?.y2 ?? 0)));
        const stroke = hexOrDefault(sh?.stroke, accent);
        slide.addShape(pptx.ShapeType.line, {
          x: SAFE_X + x1 * SAFE_W,
          y: SAFE_Y + y1 * SAFE_H,
          w: (x2 - x1) * SAFE_W,
          h: (y2 - y1) * SAFE_H,
          line: { color: pptxColor(stroke), width: 3 },
        });
      }
    }

    // Notes
    if (s?.notes) {
      try {
        (slide as any).addNotes(String(s.notes));
      } catch {
        // ignore
      }
    }
  }

  const buf = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return buf;
}
