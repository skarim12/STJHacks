import PptxGenJS from "pptxgenjs";

/**
 * Extremely simple PPTX export for local testing.
 * We intentionally avoid fancy layout until the add-in path is stable.
 */
export async function buildPptxBuffer(outline: any): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  // Title slide
  {
    const slide = pptx.addSlide();
    slide.addText(outline?.title || "Untitled Presentation", {
      x: 0.5,
      y: 1.5,
      w: 12.3,
      h: 1,
      fontFace: "Calibri",
      fontSize: 40,
      bold: true,
    });
    if (outline?.overallTheme) {
      slide.addText(String(outline.overallTheme), {
        x: 0.5,
        y: 2.6,
        w: 12.3,
        h: 0.6,
        fontFace: "Calibri",
        fontSize: 18,
        color: "666666",
      });
    }
  }

  const slides = Array.isArray(outline?.slides) ? outline.slides : [];
  for (const s of slides) {
    const slide = pptx.addSlide();

    slide.addText(String(s?.title || ""), {
      x: 0.6,
      y: 0.4,
      w: 12.0,
      h: 0.6,
      fontFace: "Calibri",
      fontSize: 30,
      bold: true,
    });

    const content: string[] = Array.isArray(s?.content) ? s.content : [];
    const bulletText = content.map((c) => `• ${String(c)}`).join("\n");

    slide.addText(bulletText || "", {
      x: 0.9,
      y: 1.3,
      w: 11.5,
      h: 5.2,
      fontFace: "Calibri",
      fontSize: 18,
      color: "111111",
      valign: "top",
    });

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
