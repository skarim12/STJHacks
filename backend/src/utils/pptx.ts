import PptxGenJS from "pptxgenjs";
import { getVariantByName, type LayoutVariant } from "./layoutVariants";

function hexOrDefault(h: any, fallback: string): string {
  const s = String(h || "").trim();
  return /^#?[0-9a-f]{6}$/i.test(s) ? (s.startsWith("#") ? s : `#${s}`) : fallback;
}

function pptxColor(hex: string): string {
  return String(hex).replace(/^#/, "").toUpperCase();
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
        slide.addImage({ data: String(s.imageDataUri), x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: SLIDE_W,
          h: SLIDE_H,
          fill: { color: "000000", transparency: 45 },
          line: { color: "000000", transparency: 100 },
        });
      } catch {
        // ignore
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
          slide.addImage({ data: String(s.imageDataUri), x: box.x, y: box.y, w: box.w, h: box.h });
        } catch {
          // ignore
        }
        continue;
      }

      if (kind === "statementCard") {
        const statement = String(content?.[0] || s?.notes || s?.describe || "").trim();
        slide.addText(statement, {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          fontFace: titleFontFace,
          fontSize: 34,
          bold: true,
          color: pptxColor(titleColor),
          valign: "top",
        });
        continue;
      }

      if (kind === "bulletsCard") {
        const p = parts[Math.min(parts.length - 1, bulletCursor++)] || [];
        const bulletText = p.map((c) => `• ${String(c)}`).join("\n");
        slide.addText(bulletText || "", {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
          fontFace: bodyFontFace,
          fontSize: Number.isFinite(bodyFontSize) ? Math.max(14, Math.min(28, Math.round(bodyFontSize * 0.42))) : 18,
          color: pptxColor(bodyColor),
          valign: "top",
        });
        continue;
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
