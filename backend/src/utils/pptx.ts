import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { getVariantByName, type LayoutVariant, variantFamily } from "./layoutVariants";

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
  const themePlan = (outline as any)?.themePlan || {};

  const panelsKind = String((themePlan as any)?.panelStyle || (themeStyle as any)?.panels || "glass");
  const headerStyle = String((themePlan as any)?.headerStyle || "bar").toLowerCase();

  // Panel "card" styling (PPT-friendly approximation of HTML cards).
  const panelFill = panelsKind === "flat" ? "FFFFFF" : pptxColor("#FFFFFF");
  const panelTransparency = panelsKind === "flat" ? 6 : 18; // glass -> more transparent
  const cornerRadius = (() => {
    const r = Number((themePlan as any)?.cornerRadius);
    return Number.isFinite(r) ? Math.max(0, Math.min(28, Math.round(r))) : 14;
  })();

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

  const hexToRgb = (h: string) => {
    const m = String(h).replace(/^#/, "").match(/^([0-9a-f]{6})$/i);
    if (!m) return { r: 0, g: 0, b: 0 };
    const x = m[1];
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16) };
  };
  const mix = (a: string, b: string, t: number) => {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const m = (x: number, y: number) => Math.round(x * (1 - t) + y * t);
    return `#${m(A.r, B.r).toString(16).padStart(2, "0")}${m(A.g, B.g).toString(16).padStart(2, "0")}${m(A.b, B.b).toString(16).padStart(2, "0")}`;
  };
  const tint = (baseHex: string, amount: number) => mix(baseHex, "#ffffff", Math.max(0, Math.min(1, amount)));

  const addCard = (
    slide: any,
    box: { x: number; y: number; w: number; h: number },
    opts?: { fillHex?: string; transparency?: number; strokeHex?: string }
  ) => {
    const fillHex = opts?.fillHex || panelFill;
    const transparency = typeof opts?.transparency === "number" ? opts.transparency : panelTransparency;
    const strokeHex = opts?.strokeHex || pptxColor(accent);

    const shapeType = cornerRadius <= 2 ? pptx.ShapeType.rect : pptx.ShapeType.roundRect;

    slide.addShape(shapeType, {
      x: box.x,
      y: box.y,
      w: box.w,
      h: box.h,
      fill: { color: fillHex, transparency },
      line: { color: strokeHex, transparency: 92 },
      // Note: pptxgenjs typing may not expose radius; we approximate by rect vs roundRect.

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

  const h32 = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) >>> 0;
  };

  const pick01 = (seed: string) => {
    const x = h32(seed) % 1000;
    return x / 999;
  };

  const addMotif = (slide: any, seed: string, _themePrompt: string) => {
    // Deterministic PPT-friendly background motif behind content.
    // IMPORTANT: prefer outline.themePlan (do NOT keyword-guess from prompt in the renderer).
    const planMotif = String((themePlan as any)?.motif || "").toLowerCase();
    const motif = (["ribbons", "grid", "corners", "diagonal"] as const).includes(planMotif as any)
      ? (planMotif as any)
      : "ribbons";

    const intensity = String((themePlan as any)?.intensity || "medium").toLowerCase();
    const intensityLevel = intensity === "low" ? 0 : intensity === "high" ? 2 : 1;

    // Use very subtle tints so content remains readable.
    const aTint = pptxColor(tint(accent, 0.90));
    const bTint = pptxColor(tint(secondary, 0.90));

    const transBase = intensityLevel === 0 ? 87 : intensityLevel === 2 ? 75 : 81;

    if (motif === "grid") {
      // Dot grid using tiny squares (pptx has no dot primitive).
      const step = 0.55;
      for (let x = 0.9; x < SLIDE_W - 0.9; x += step) {
        for (let y = 0.8; y < SLIDE_H - 0.8; y += step) {
          const t = pick01(`${seed}|${x}|${y}`);
          const keepThreshold = intensityLevel === 0 ? 0.10 : intensityLevel === 2 ? 0.28 : 0.18;
          if (t > keepThreshold) continue; // sparse/dense depending on intensity
          slide.addShape(pptx.ShapeType.rect, {
            x,
            y,
            w: 0.03,
            h: 0.03,
            fill: { color: t > 0.09 ? aTint : bTint, transparency: transBase },
            line: { color: "FFFFFF", transparency: 100 },
          });
        }
      }
      return;
    }

    if (motif === "corners") {
      // Corner frames.
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.3,
        y: 0.3,
        w: 2.4,
        h: 0.22,
        fill: { color: aTint, transparency: transBase + 2 },
        line: { color: aTint, transparency: 100 },
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.3,
        y: 0.3,
        w: 0.22,
        h: 1.6,
        fill: { color: bTint, transparency: transBase + 2 },
        line: { color: bTint, transparency: 100 },
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: SLIDE_W - 2.7,
        y: SLIDE_H - 0.55,
        w: 2.4,
        h: 0.22,
        fill: { color: bTint, transparency: transBase + 4 },
        line: { color: bTint, transparency: 100 },
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: SLIDE_W - 0.52,
        y: SLIDE_H - 2.1,
        w: 0.22,
        h: 1.6,
        fill: { color: aTint, transparency: transBase + 4 },
        line: { color: aTint, transparency: 100 },
      });
      return;
    }

    if (motif === "diagonal") {
      // Diagonal bands.
      slide.addShape(pptx.ShapeType.parallelogram, {
        x: -1.2,
        y: 0.9,
        w: 7.0,
        h: 0.55,
        fill: { color: aTint, transparency: transBase + 4 },
        line: { color: aTint, transparency: 100 },
      });
      slide.addShape(pptx.ShapeType.parallelogram, {
        x: 5.5,
        y: 5.9,
        w: 7.0,
        h: 0.55,
        fill: { color: bTint, transparency: transBase + 6 },
        line: { color: bTint, transparency: 100 },
      });
      return;
    }

    // ribbons
    slide.addShape(pptx.ShapeType.roundRect, {
      x: -0.8,
      y: 1.0,
      w: 4.6,
      h: 0.42,
      fill: { color: aTint, transparency: transBase + 4 },
      line: { color: aTint, transparency: 100 },
    });
    slide.addShape(pptx.ShapeType.roundRect, {
      x: SLIDE_W - 3.9,
      y: SLIDE_H - 1.35,
      w: 4.6,
      h: 0.42,
      fill: { color: bTint, transparency: transBase + 6 },
      line: { color: bTint, transparency: 100 },
    });
  };

  const DEBUG_OVERLAY = String(process.env.PPTX_DEBUG_OVERLAY || "").toLowerCase() === "true";

  const addDebugOverlay = (slide: any, variantName: string) => {
    if (!DEBUG_OVERLAY) return;
    // Safe-area boundary
    slide.addShape(pptx.ShapeType.rect, {
      x: SAFE_X,
      y: SAFE_Y,
      w: SAFE_W,
      h: SAFE_H,
      fill: { color: "FFFFFF", transparency: 100 },
      line: { color: "FF00FF", transparency: 60, width: 1 },
    });
    // 12x8 grid lines
    for (let c = 1; c < 12; c++) {
      const x = SAFE_X + (c / 12) * SAFE_W;
      slide.addShape(pptx.ShapeType.line, {
        x,
        y: SAFE_Y,
        w: 0,
        h: SAFE_H,
        line: { color: "FF00FF", transparency: 85, width: 0.5 },
      });
    }
    for (let r = 1; r < 8; r++) {
      const y = SAFE_Y + (r / 8) * SAFE_H;
      slide.addShape(pptx.ShapeType.line, {
        x: SAFE_X,
        y,
        w: SAFE_W,
        h: 0,
        line: { color: "FF00FF", transparency: 85, width: 0.5 },
      });
    }

    slide.addText(`variant: ${variantName}`, {
      x: SAFE_X,
      y: 0.1,
      w: SAFE_W,
      h: 0.3,
      fontFace: "Segoe UI",
      fontSize: 10,
      color: "FF00FF",
    });
  };

  // Title slide
  {
    const slide = pptx.addSlide();
    addBg(slide);
    addMotif(slide, `title:${String(outline?.title || "")}`, String((outline as any)?.themePrompt || ""));

    if (headerStyle !== "minimal") {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: headerStyle === "underline" ? 0.08 : 0.18,
        fill: { color: pptxColor(accent) },
        line: { color: pptxColor(accent) },
      });
    }

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
    const themePrompt = String((outline as any)?.themePrompt || (outline as any)?.decoratePrompt || "");
    addMotif(slide, `slide:${variantName}:${String(s?.title || "")}:${String(s?.describe || "")}`, themePrompt);
    addDebugOverlay(slide, variantName);

    const variant: LayoutVariant | null = getVariantByName(variantName);
    const hasImage = typeof s?.imageDataUri === "string" && s.imageDataUri.startsWith("data:image/");

    const sp = s?.stylePlan || {};
    const titlePlan = sp?.title || {};
    const bodyPlan = sp?.body || {};

    const titleFontFace = String(titlePlan?.fontFace || "Calibri");
    const titleFontSize = Number(titlePlan?.fontSize);

    // Titles are often outside cards; use deck text color by default.
    const titleColor = hexOrDefault(titlePlan?.color, text);

    const bodyFontFace = String(bodyPlan?.fontFace || "Calibri");
    const bodyFontSize = Number(bodyPlan?.fontSize);

    // Most layouts render body content inside light "cards"; default to dark text for readability.
    const defaultCardText = "#0B1220";
    const bodyColor = hexOrDefault(bodyPlan?.color, defaultCardText);

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

    const fam = variantFamily(variantName);
    let cardIndex = 0;

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
        const headerH = Math.min(box.h, 1.1);
        const kicker =
          String((s as any)?.kicker || "").trim() ||
          (String(s?.slideType || "").toLowerCase() === "comparison"
            ? "COMPARISON"
            : String(s?.slideType || "").toLowerCase() === "quote"
              ? "QUOTE"
              : String(s?.slideType || "").toLowerCase() === "imageplaceholder"
                ? "VISUAL"
                : "KEY POINTS");

        if (headerStyle === "bar") {
          // Kicker pill (adds immediate visual variety)
          const pillW = Math.min(3.0, box.w * 0.45);
          const pillFill = pptxColor(tint(accent, 0.0));
          slide.addShape(pptx.ShapeType.roundRect, {
            x: box.x,
            y: box.y,
            w: pillW,
            h: 0.32,
            fill: { color: pillFill, transparency: 10 },
            line: { color: pillFill, transparency: 100 },
            // radius not supported in typings

          });
          slide.addText(kicker, {
            x: box.x + 0.12,
            y: box.y + 0.05,
            w: pillW - 0.24,
            h: 0.26,
            fontFace: "Segoe UI",
            fontSize: 12,
            bold: true,
            color: "FFFFFF",
          });
        } else if (headerStyle === "underline") {
          // Plain kicker (no pill)
          slide.addText(kicker, {
            x: box.x,
            y: box.y + 0.02,
            w: box.w,
            h: 0.26,
            fontFace: "Segoe UI",
            fontSize: 12,
            bold: true,
            color: pptxColor(accent),
          });
        }
        // minimal => no kicker ornament

        const titleY = headerStyle === "bar" ? box.y + 0.36 : headerStyle === "underline" ? box.y + 0.30 : box.y;
        slide.addText(String(s?.title || ""), {
          x: box.x,
          y: titleY,
          w: box.w,
          h: headerH - 0.36,
          fontFace: titleFontFace,
          fontSize: Number.isFinite(titleFontSize) ? Math.max(18, Math.min(48, Math.round(titleFontSize * 0.48))) : 30,
          bold: String(titlePlan?.weight || "bold") === "bold",
          color: pptxColor(titleColor),
        });

        if (headerStyle !== "minimal") {
          slide.addShape(pptx.ShapeType.rect, {
            x: box.x,
            y: box.y + headerH - 0.06,
            w: Math.min(5.5, box.w),
            h: headerStyle === "underline" ? 0.04 : 0.05,
            fill: { color: pptxColor(accent) },
            line: { color: pptxColor(accent) },
          });
        }
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
        // Callouts should pop: use accent/secondary tints depending on family.
        const fill = fam === "callout" ? pptxColor(accent) : pptxColor(tint(accent, 0.15));
        addCard(slide, box, { fillHex: fill, transparency: fam === "callout" ? 55 : 72, strokeHex: pptxColor(accent) });
        const inner = inset(box, 0.18);
        const statement = String(content?.[0] || s?.notes || s?.describe || "").trim();
        slide.addText(statement, {
          x: inner.x,
          y: inner.y,
          w: inner.w,
          h: inner.h,
          fontFace: titleFontFace,
          fontSize: 28,
          bold: true,
          color: pptxColor(titleColor),
          valign: "top",
        });
        continue;
      }

      if (kind === "bulletsCard") {
        // Card fill variety by family + card index (deterministic).
        const useAlt = (cardIndex++ % 2) === 1;
        const baseTint =
          fam === "grid" ? (useAlt ? tint(secondary, 0.86) : tint(accent, 0.88)) :
          fam === "stack" ? (useAlt ? tint(accent, 0.90) : tint(secondary, 0.90)) :
          fam === "asym" ? (useAlt ? tint(accent, 0.92) : tint(secondary, 0.92)) :
          fam === "accent" ? tint(accent, 0.90) :
          tint(accent, 0.93);

        addCard(slide, box, { fillHex: pptxColor(baseTint), transparency: panelsKind === "flat" ? 6 : 14 });
        const inner = inset(box, 0.18);
        const p = parts[Math.min(parts.length - 1, bulletCursor++)] || [];

        // Bullet hierarchy: first bullet becomes a lead line (bold) when the card has enough space.
        const lead = p.length ? String(p[0] || "").trim() : "";
        const rest = p.slice(1);

        const baseSize = Number.isFinite(bodyFontSize) ? Math.max(14, Math.min(26, Math.round(bodyFontSize * 0.40))) : 18;

        if (lead && rest.length >= 2 && inner.h >= 1.6) {
          slide.addText(lead, {
            x: inner.x,
            y: inner.y,
            w: inner.w,
            h: 0.5,
            fontFace: bodyFontFace,
            fontSize: Math.min(22, baseSize + 2),
            bold: true,
            color: pptxColor(bodyColor),
            valign: "top",
          });

          const bulletText = rest.map((c) => `• ${String(c)}`).join("\n");
          slide.addText(bulletText || "", {
            x: inner.x,
            y: inner.y + 0.55,
            w: inner.w,
            h: Math.max(0.2, inner.h - 0.55),
            fontFace: bodyFontFace,
            fontSize: baseSize,
            color: pptxColor(bodyColor),
            valign: "top",
          });
        } else {
          const bulletText = p.map((c) => `• ${String(c)}`).join("\n");
          slide.addText(bulletText || "", {
            x: inner.x,
            y: inner.y,
            w: inner.w,
            h: inner.h,
            fontFace: bodyFontFace,
            fontSize: baseSize,
            color: pptxColor(bodyColor),
            valign: "top",
          });
        }
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
