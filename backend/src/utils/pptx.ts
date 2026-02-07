import PptxGenJS from "pptxgenjs";
import { enforceThemeStyle } from "./themeStyle";

function hexOrDefault(h: any, fallback: string): string {
  const s = String(h || "").trim();
  return /^#?[0-9a-f]{6}$/i.test(s) ? (s.startsWith("#") ? s : `#${s}`) : fallback;
}

function pptxColor(hex: string): string {
  return String(hex).replace(/^#/, "").toUpperCase();
}

/**
 * PPTX export with basic theming + optional images.
 * Still deterministic: uses the precomputed layoutPlan variant names.
 */
export async function buildPptxBuffer(outline: any): Promise<Buffer> {
  enforceThemeStyle(outline);

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const scheme = outline?.colorScheme || {};
  const bg = hexOrDefault(scheme.background, "#FFFFFF");
  const text = hexOrDefault(scheme.text, "#111111");
  const accent = hexOrDefault(scheme.accent || scheme.primary, "#0078D4");

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
      w: 13.33,
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

    const variant = String(s?.layoutPlan?.variant || "content.singleCard");
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

    // Header
    slide.addText(String(s?.title || ""), {
      x: 0.7,
      y: 0.45,
      w: 12.0,
      h: 0.6,
      fontFace: titleFontFace,
      fontSize: Number.isFinite(titleFontSize) ? Math.max(18, Math.min(48, Math.round(titleFontSize * 0.48))) : 30,
      bold: String(titlePlan?.weight || "bold") === "bold",
      color: pptxColor(titleColor),
    });

    // Accent divider
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.7,
      y: 1.15,
      w: 6.0,
      h: 0.04,
      fill: { color: pptxColor(accent) },
      line: { color: pptxColor(accent) },
    });

    const content: string[] = Array.isArray(s?.content) ? s.content : [];
    const bulletText = content.map((c) => `• ${String(c)}`).join("\n");

    // Layout mapping from variants → regions (wide layout: 13.33 x 7.5 inches)
    const regions = (() => {
      switch (variant) {
        case "content.twoColBullets":
          return {
            bulletsLeft: { x: 0.9, y: 1.45, w: 5.9, h: 5.7 },
            bulletsRight: { x: 7.2, y: 1.45, w: 5.9, h: 5.7 },
          };
        case "content.leftAccentBar":
          return {
            accentBar: { x: 0.55, y: 0.55, w: 0.20, h: 6.7 },
            bullets: { x: 0.95, y: 1.45, w: 12.0, h: 5.7 },
          };
        case "content.statement":
          return {
            statement: { x: 0.95, y: 1.65, w: 12.0, h: 5.3 },
          };
        case "image.fullBleed":
          return {
            imageFull: { x: 0, y: 0, w: 13.33, h: 7.5 },
            overlay: { x: 0.85, y: 1.35, w: 6.3, h: 5.9 },
          };
        default:
          break;
      }

      if (variant.includes("split") && hasImage) {
        // bullets left, image right
        return {
          bullets: { x: 0.9, y: 1.45, w: 7.2, h: 5.7 },
          image: { x: 8.35, y: 1.45, w: 4.7, h: 5.7 },
        };
      }
      if (variant.startsWith("image.") && hasImage) {
        // image big, bullets small
        return {
          image: { x: 0.9, y: 1.45, w: 8.2, h: 5.7 },
          bullets: { x: 9.25, y: 1.45, w: 3.8, h: 5.7 },
        };
      }
      if (variant.startsWith("quote.splitImage") && hasImage) {
        return {
          bullets: { x: 0.9, y: 1.45, w: 7.2, h: 5.7 },
          image: { x: 8.35, y: 1.45, w: 4.7, h: 5.7 },
        };
      }
      // default: full-width text
      return { bullets: { x: 0.9, y: 1.45, w: 12.1, h: 5.7 } };
    })();

    const baseBodySize = Number.isFinite(bodyFontSize) ? Math.max(14, Math.min(28, Math.round(bodyFontSize * 0.42))) : 18;

    // Text
    if ((regions as any).statement) {
      const statement = String(content[0] || s?.notes || "").trim();
      slide.addText(statement, {
        ...(regions as any).statement,
        fontFace: bodyFontFace,
        fontSize: Math.max(22, Math.min(40, Math.round(baseBodySize * 1.6))),
        bold: true,
        color: pptxColor(bodyColor),
        valign: "top",
      });
    } else if ((regions as any).bulletsLeft && (regions as any).bulletsRight) {
      const left: string[] = [];
      const right: string[] = [];
      for (let j = 0; j < content.length; j++) (j % 2 === 0 ? left : right).push(content[j]);
      const leftText = left.map((c) => `• ${String(c)}`).join("\n");
      const rightText = right.map((c) => `• ${String(c)}`).join("\n");
      slide.addText(leftText, { ...(regions as any).bulletsLeft, fontFace: bodyFontFace, fontSize: baseBodySize, color: pptxColor(bodyColor), valign: "top" });
      slide.addText(rightText, { ...(regions as any).bulletsRight, fontFace: bodyFontFace, fontSize: baseBodySize, color: pptxColor(bodyColor), valign: "top" });
    } else if ((regions as any).overlay) {
      // Full-bleed overlay panel.
      slide.addShape(pptx.ShapeType.roundRect, {
        ...(regions as any).overlay,
        fill: { color: pptxColor(bg), transparency: 35 },
        line: { color: pptxColor(bg), transparency: 100 },
      });
      slide.addText(bulletText || "", {
        x: (regions as any).overlay.x + 0.25,
        y: (regions as any).overlay.y + 0.25,
        w: (regions as any).overlay.w - 0.5,
        h: (regions as any).overlay.h - 0.5,
        fontFace: bodyFontFace,
        fontSize: baseBodySize,
        color: pptxColor(bodyColor),
        valign: "top",
      });
    } else {
      slide.addText(bulletText || "", {
        x: (regions as any).bullets.x,
        y: (regions as any).bullets.y,
        w: (regions as any).bullets.w,
        h: (regions as any).bullets.h,
        fontFace: bodyFontFace,
        fontSize: baseBodySize,
        color: pptxColor(bodyColor),
        valign: "top",
      });
    }

    // Left accent bar (variant-specific)
    if ((regions as any).accentBar) {
      slide.addShape(pptx.ShapeType.roundRect, {
        ...(regions as any).accentBar,
        fill: { color: pptxColor(accent) },
        line: { color: pptxColor(accent) },
      });
    }

    // Decorative shapes (AI-drawn) – rendered behind content.
    const shapes = Array.isArray(sp?.shapes) ? sp.shapes : [];
    for (const sh of shapes.slice(0, 12)) {
      const kind = String(sh?.kind || "").toLowerCase();
      if (kind === "rect") {
        const x = Math.max(0, Math.min(1, Number(sh?.x ?? 0)));
        const y = Math.max(0, Math.min(1, Number(sh?.y ?? 0)));
        const w = Math.max(0.02, Math.min(1, Number(sh?.w ?? 0.2)));
        const h = Math.max(0.02, Math.min(1, Number(sh?.h ?? 0.1)));
        const fill = hexOrDefault(sh?.fill, accent);
        const stroke = sh?.stroke ? hexOrDefault(sh?.stroke, accent) : undefined;
        const sw = Number(sh?.strokeWidth ?? 0);

        // Map SAFE area to slide inches (roughly match HTML safe margins).
        const safeX = 0.85;
        const safeY = 0.65;
        const safeW = 13.33 - 2 * safeX;
        const safeH = 7.5 - 2 * safeY;

        slide.addShape(pptx.ShapeType.roundRect, {
          x: safeX + x * safeW,
          y: safeY + y * safeH,
          w: w * safeW,
          h: h * safeH,
          fill: { color: pptxColor(fill) },
          line: stroke && Number.isFinite(sw) && sw > 0 ? { color: pptxColor(stroke), width: Math.min(6, Math.max(1, Math.round(sw / 2))) } : { color: pptxColor(fill), transparency: 100 },
        });
      }
      if (kind === "line") {
        const x1 = Math.max(0, Math.min(1, Number(sh?.x1 ?? 0)));
        const y1 = Math.max(0, Math.min(1, Number(sh?.y1 ?? 0)));
        const x2 = Math.max(0, Math.min(1, Number(sh?.x2 ?? 0.4)));
        const y2 = Math.max(0, Math.min(1, Number(sh?.y2 ?? 0)));
        const stroke = hexOrDefault(sh?.stroke, accent);
        const sw = Number(sh?.strokeWidth ?? 4);

        const safeX = 0.85;
        const safeY = 0.65;
        const safeW = 13.33 - 2 * safeX;
        const safeH = 7.5 - 2 * safeY;

        slide.addShape(pptx.ShapeType.line, {
          x: safeX + x1 * safeW,
          y: safeY + y1 * safeH,
          w: (x2 - x1) * safeW,
          h: (y2 - y1) * safeH,
          line: { color: pptxColor(stroke), width: Math.min(10, Math.max(1, Math.round(sw / 2))) },
        });
      }
    }

    // Image
    if (hasImage && (regions as any).imageFull) {
      try {
        slide.addImage({ data: String(s.imageDataUri), ...(regions as any).imageFull });
        // Dark overlay for legibility (PptxGen transparency is best-effort across viewers).
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: 13.33,
          h: 7.5,
          fill: { color: pptxColor("#000000"), transparency: 55 },
          line: { color: pptxColor("#000000"), transparency: 100 },
        });
      } catch {
        // ignore image errors so PPTX still exports
      }
    } else if (hasImage && (regions as any).image) {
      try {
        slide.addImage({ data: String(s.imageDataUri), ...(regions as any).image });
      } catch {
        // ignore image errors so PPTX still exports
      }
    }

    // Speaker notes (best-effort)
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
