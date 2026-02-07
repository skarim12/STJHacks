import { config } from "../config/config";
import type { AxiosInstance } from "axios";

export type Slide = {
  title?: string;
  slideType?: string;
  content?: string[];
  notes?: string;
  suggestedLayout?: string;
};

export type Outline = {
  title?: string;
  overallTheme?: string;
  colorScheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  slides?: Slide[];
};

// Shared CSS: one HTML doc with multiple .slide pages.
export function wrapDeckHtml(slideHtml: string, outline: Outline): string {
  const bg = outline?.colorScheme?.background || "#ffffff";
  const text = outline?.colorScheme?.text || "#111111";
  const accent = outline?.colorScheme?.accent || "#2563eb";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(outline?.title || "Deck")}</title>
  <style>
    @page { size: 1920px 1080px; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: ${bg}; color: ${text}; }

    .slide {
      width: 1920px;
      height: 1080px;
      box-sizing: border-box;
      padding: 96px 120px;
      position: relative;
      background: ${bg};
      page-break-after: always;
      overflow: hidden;
    }
    .accent-bar { position: absolute; left: 0; top: 0; height: 18px; width: 100%; background: ${accent}; }
    h1 { font-size: 80px; margin: 0 0 40px 0; line-height: 1.05; }
    h2 { font-size: 64px; margin: 0 0 36px 0; line-height: 1.1; }
    ul { margin: 0; padding-left: 44px; font-size: 42px; line-height: 1.25; }
    li { margin: 18px 0; }
    .footer { position: absolute; right: 64px; bottom: 48px; font-size: 26px; opacity: 0.6; }
    .subtitle { font-size: 40px; opacity: 0.9; margin-top: 10px; }
  </style>
</head>
<body>
${slideHtml}
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Create a prompt for Anthropic to return ONE slide's inner HTML.
 * We wrap it ourselves into the global template.
 */
export function buildSlideHtmlPrompt(slide: Slide, index: number, outline: Outline): { system: string; user: string } {
  const system = `You generate HTML for a single PowerPoint-like slide.

Rules (critical):
- Return STRICT JSON only: {"html":"..."}
- The html value MUST be a single <section class=\"slide\">...</section> block.
- No <script>, no external assets, no iframes.
- Assume slide canvas is 1920x1080 with padding already handled by CSS.
- Use only semantic tags: h1/h2/p/ul/li/div/span.
- Keep layout simple and consistent.
`.trim();

  const user = `Deck title: ${outline?.title || ""}
Deck theme: ${outline?.overallTheme || ""}
Slide #${index + 1}
Slide title: ${slide?.title || ""}
Slide type: ${slide?.slideType || "content"}
Bullets:
${(Array.isArray(slide?.content) ? slide.content : []).map((b) => `- ${b}`).join("\n")}

Return one <section class="slide"> with:
- a top accent bar div: <div class="accent-bar"></div>
- a title (h1 for first slide if it reads like a title slide, else h2)
- a <ul> for bullets when present
- a small footer with slide number in <div class="footer">${index + 1}</div>
`;

  return { system, user };
}

export function outlineToSimpleSlides(outline: Outline): string {
  const slides = Array.isArray(outline?.slides) ? outline.slides : [];
  return slides
    .map((s, i) => {
      const title = escapeHtml(s?.title || "");
      const bullets = (Array.isArray(s?.content) ? s.content : []).map((b) => `<li>${escapeHtml(b)}</li>`).join("");
      return `
<section class="slide">
  <div class="accent-bar"></div>
  <h2>${title}</h2>
  ${bullets ? `<ul>${bullets}</ul>` : ""}
  <div class="footer">${i + 1}</div>
</section>`;
    })
    .join("\n");
}

/**
 * AI-driven slide HTML generation. You pass in an anthropicJsonRequest-like function.
 */
export async function outlineToAiSlides(
  outline: Outline,
  anthropicJsonRequest: (cacheKey: string, system: string, user: string, maxTokens?: number) => Promise<any>,
  options?: { concurrency?: number }
): Promise<string> {
  const slides = Array.isArray(outline?.slides) ? outline.slides : [];
  const concurrency = options?.concurrency ?? 2;

  const results: string[] = new Array(slides.length).fill("");

  let idx = 0;
  const workers = new Array(concurrency).fill(0).map(async () => {
    while (idx < slides.length) {
      const i = idx++;
      const slide = slides[i];
      const { system, user } = buildSlideHtmlPrompt(slide, i, outline);

      const cacheKey = `slidehtml:${config.defaultModel}:${outline?.title || ""}:${i}:${(slide?.title || "").slice(0, 80)}`;
      const json = await anthropicJsonRequest(cacheKey, system, user, 2048);
      const html = String((json as any)?.html || "").trim();
      if (!html.startsWith("<section") || !html.includes("class=\"slide\"")) {
        throw new Error(`AI returned invalid slide HTML for slide ${i + 1}`);
      }
      results[i] = html;
    }
  });

  await Promise.all(workers);
  return results.join("\n");
}
