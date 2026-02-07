import PptxGenJS from "pptxgenjs";

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

    // Very simple mapping from variants → regions (wide layout: 13.33 x 7.5 inches)
    const regions = (() => {
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

    // Text
    slide.addText(bulletText || "", {
      x: regions.bullets.x,
      y: regions.bullets.y,
      w: regions.bullets.w,
      h: regions.bullets.h,
      fontFace: bodyFontFace,
      fontSize: Number.isFinite(bodyFontSize) ? Math.max(14, Math.min(28, Math.round(bodyFontSize * 0.42))) : 18,
      color: pptxColor(bodyColor),
      valign: "top",
    });

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
    if (hasImage && regions.image) {
      try {
        slide.addImage({ data: String(s.imageDataUri), ...regions.image });
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
