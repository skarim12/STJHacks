import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/**
 * Minimal PPTX text extraction.
 * PPTX is a zip containing slide XMLs at ppt/slides/slide*.xml.
 * We extract all <a:t> text nodes.
 */
export async function extractTextFromPptxBuffer(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const parser = new XMLParser({ ignoreAttributes: false });

  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
      return na - nb;
    });

  const allSlides: string[] = [];

  for (const p of slidePaths) {
    const xml = await zip.file(p)!.async("text");
    const json = parser.parse(xml);

    const texts: string[] = [];

    // Recursively collect a:t
    const walk = (node: any) => {
      if (!node) return;
      if (typeof node === "string") return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (k === "a:t") {
            if (typeof v === "string") texts.push(v);
            else if (Array.isArray(v)) v.forEach((s) => typeof s === "string" && texts.push(s));
          } else {
            walk(v);
          }
        }
      }
    };

    walk(json);
    const slideNum = Number(p.match(/slide(\d+)\.xml/)?.[1] || 0);
    allSlides.push(`Slide ${slideNum}: ${texts.join(" ")}`.trim());
  }

  return allSlides.join("\n");
}
