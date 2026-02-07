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

// -----------------------------
// Helpers: escape + guards
// -----------------------------

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampText(s: string, maxChars: number): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  return t.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

function stripUnsafe(s: string): string {
  // We never want model/user content to contain HTML tags or URLs.
  const t = String(s ?? "").trim();
  const withoutTags = t.replace(/<[^>]*>/g, "");
  const withoutUrls = withoutTags.replace(/\bhttps?:\/\/\S+/gi, "").replace(/\bdata:[^\s]+/gi, "");
  return withoutUrls.trim().replace(/\s+/g, " ");
}

function normalizeBullets(bullets: unknown, maxItems: number, maxCharsEach: number): string[] {
  const arr = Array.isArray(bullets) ? bullets : [];
  const cleaned = arr
    .map((b) => stripUnsafe(String(b)))
    .filter(Boolean)
    .map((b) => clampText(b, maxCharsEach));
  return cleaned.slice(0, maxItems);
}

function pickKicker(slide: Slide, outline: Outline): string {
  const raw =
    slide?.suggestedLayout ||
    slide?.slideType ||
    outline?.overallTheme ||
    "";
  const t = stripUnsafe(raw);
  return clampText(t, 36);
}

function normalizeSlideType(t: unknown): "title" | "content" | "comparison" | "quote" | "imagePlaceholder" {
  const s = String(t ?? "").toLowerCase().trim();
  if (s === "title") return "title";
  if (s === "comparison") return "comparison";
  if (s === "quote") return "quote";
  if (s === "image" || s === "imageplaceholder" || s === "image-placeholder") return "imagePlaceholder";
  return "content";
}

function computeDensity(bullets: string[]): "normal" | "compact" {
  if (bullets.length > 6) return "compact";
  if (bullets.some((b) => b.length > 105)) return "compact";
  return "normal";
}

function parseComparison(slide: Slide): { leftTitle: string; rightTitle: string; leftBullets: string[]; rightBullets: string[] } {
  const raw = Array.isArray(slide?.content) ? slide.content : [];
  const cleaned = raw.map((b) => stripUnsafe(String(b))).filter(Boolean);

  // Heuristic 1: Pros/Cons or Advantages/Disadvantages
  const left: string[] = [];
  const right: string[] = [];
  for (const b of cleaned) {
    const m = b.match(/^(pros?|advantages?)\s*:\s*(.+)$/i);
    if (m) {
      left.push(m[2]);
      continue;
    }
    const m2 = b.match(/^(cons?|disadvantages?)\s*:\s*(.+)$/i);
    if (m2) {
      right.push(m2[2]);
      continue;
    }
  }
  if (left.length || right.length) {
    return {
      leftTitle: "Pros",
      rightTitle: "Cons",
      leftBullets: normalizeBullets(left, 5, 120),
      rightBullets: normalizeBullets(right, 5, 120),
    };
  }

  // Heuristic 2: Left:/Right:
  const left2: string[] = [];
  const right2: string[] = [];
  for (const b of cleaned) {
    const m = b.match(/^left\s*:\s*(.+)$/i);
    if (m) {
      left2.push(m[1]);
      continue;
    }
    const m2 = b.match(/^right\s*:\s*(.+)$/i);
    if (m2) {
      right2.push(m2[1]);
      continue;
    }
  }
  if (left2.length || right2.length) {
    return {
      leftTitle: "Option A",
      rightTitle: "Option B",
      leftBullets: normalizeBullets(left2, 5, 120),
      rightBullets: normalizeBullets(right2, 5, 120),
    };
  }

  // Fallback: split evenly
  const mid = Math.ceil(cleaned.length / 2);
  return {
    leftTitle: "Option A",
    rightTitle: "Option B",
    leftBullets: normalizeBullets(cleaned.slice(0, mid), 5, 120),
    rightBullets: normalizeBullets(cleaned.slice(mid), 5, 120),
  };
}

// -----------------------------
// Theme + base CSS (design system)
// -----------------------------

function cssVarsFromOutline(outline: Outline): { bg: string; text: string; accent: string; accent2: string } {
  const bg = String(outline?.colorScheme?.background || "#0b1220");
  const text = String(outline?.colorScheme?.text || "#ffffff");
  const accent = String(outline?.colorScheme?.accent || outline?.colorScheme?.primary || "#6ee7ff");
  const accent2 = String(outline?.colorScheme?.secondary || "#a78bfa");
  return { bg, text, accent, accent2 };
}

// Shared CSS: one HTML doc with multiple .slide pages.
export function wrapDeckHtml(slideHtml: string, outline: Outline): string {
  const { bg, text, accent, accent2 } = cssVarsFromOutline(outline);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(stripUnsafe(outline?.title || "Deck"))}</title>
  <style>
    @page { size: 1920px 1080px; margin: 0; }
    html, body { margin: 0; padding: 0; background: transparent; }

    :root{
      --slide-w: 1920px;
      --slide-h: 1080px;

      --margin-x: 120px;
      --margin-y: 96px;
      --gutter: 48px;
      --row-gap: 28px;

      --r-lg: 28px;
      --r-md: 18px;
      --r-sm: 12px;
      --stroke: 2px;

      --shadow-1: 0 10px 30px rgba(0,0,0,.10);

      --font-sans: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;

      --title: 72px;
      --subtitle: 40px;
      --kicker: 22px;
      --body: 30px;
      --small: 22px;

      --lh-title: 1.08;
      --lh-body: 1.25;

      --w-regular: 400;
      --w-medium: 600;
      --w-bold: 750;

      --tracking-kicker: .14em;

      --bg: ${bg};
      --text: ${text};
      --muted: rgba(255,255,255,.72);
      --faint: rgba(255,255,255,.48);

      --panel: rgba(255,255,255,.06);
      --panel-2: rgba(255,255,255,.10);

      --accent: ${accent};
      --accent-2: ${accent2};
      --stroke-color: rgba(255,255,255,.12);
    }

    body{ font-family: var(--font-sans); color: var(--text); }

    .slide{
      width: var(--slide-w);
      height: var(--slide-h);
      box-sizing: border-box;
      position: relative;
      background: var(--bg);
      page-break-after: always;
      overflow: hidden;
      display: flex;
    }

    .slide[data-density="compact"]{
      --body: 26px;
      --row-gap: 22px;
      --gutter: 40px;
    }

    .safe{
      margin: var(--margin-y) var(--margin-x);
      width: calc(var(--slide-w) - 2*var(--margin-x));
      height: calc(var(--slide-h) - 2*var(--margin-y));
      display: flex;
      flex-direction: column;
      gap: var(--row-gap);
      min-height: 0;
    }

    .header{ display:flex; flex-direction:column; gap:14px; }

    .kicker{
      font-size: var(--kicker);
      letter-spacing: var(--tracking-kicker);
      text-transform: uppercase;
      color: var(--muted);
    }

    .title{
      font-size: var(--title);
      font-weight: var(--w-bold);
      line-height: var(--lh-title);
      margin: 0;
    }

    .subtitle{
      font-size: var(--subtitle);
      font-weight: var(--w-medium);
      color: var(--muted);
      line-height: 1.15;
      margin: 0;
    }

    .divider{
      height: 2px;
      background: linear-gradient(90deg, var(--accent), transparent);
      opacity: .9;
    }

    .body{ flex:1; display:flex; min-height:0; }

    .grid-2{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--gutter);
      width: 100%;
      min-height: 0;
    }

    .card{
      background: var(--panel);
      border: var(--stroke) solid var(--stroke-color);
      border-radius: var(--r-lg);
      padding: 42px 44px;
      box-shadow: var(--shadow-1);
      display:flex;
      flex-direction:column;
      gap: 22px;
      min-height: 0;
    }

    .card-title{
      font-size: 34px;
      font-weight: var(--w-bold);
      color: var(--text);
      margin: 0;
    }

    .bullets{ margin: 0; padding-left: 1.1em; display:flex; flex-direction:column; gap: 14px; }
    .bullets li{ font-size: var(--body); line-height: var(--lh-body); color: var(--text); }
    .bullets li::marker{ color: var(--accent); }

    .note-overflow{ font-size: var(--small); color: var(--faint); }

    .quote{
      border-left: 10px solid var(--accent);
      padding-left: 34px;
      font-size: 54px;
      line-height: 1.15;
      font-weight: var(--w-medium);
    }

    .quote-by{ margin-top: 16px; font-size: 28px; color: var(--muted); }

    .placeholder{
      flex: 1;
      border-radius: var(--r-lg);
      border: var(--stroke) dashed rgba(255,255,255,.22);
      background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      color: var(--muted);
      font-size: 26px;
      padding: 40px;
      min-height: 0;
    }

    .footer{
      position: absolute;
      left: var(--margin-x);
      right: var(--margin-x);
      bottom: 48px;
      display:flex;
      justify-content: space-between;
      font-size: 20px;
      color: var(--faint);
    }
  </style>
</head>
<body>
${slideHtml}
</body>
</html>`;
}

// -----------------------------
// Deterministic slide rendering (no arbitrary HTML from AI)
// -----------------------------

function renderHeader(opts: { kicker?: string; title: string; subtitle?: string }): string {
  const kicker = opts.kicker ? `<div class="kicker">${escapeHtml(opts.kicker)}</div>` : "";
  const subtitle = opts.subtitle ? `<p class="subtitle">${escapeHtml(opts.subtitle)}</p>` : "";
  return `
  <div class="header">
    ${kicker}
    <h1 class="title">${escapeHtml(opts.title)}</h1>
    ${subtitle}
  </div>
  <div class="divider"></div>`;
}

function renderBullets(bullets: string[], max: number): { html: string; overflowNote: string } {
  const shown = bullets.slice(0, max);
  const overflow = Math.max(0, bullets.length - shown.length);
  const lis = shown.map((b) => `<li>${escapeHtml(b)}</li>`).join("");
  return {
    html: lis ? `<ul class="bullets">${lis}</ul>` : "",
    overflowNote: overflow ? `<div class="note-overflow">+ ${overflow} more</div>` : "",
  };
}

function renderSlideSection(
  inner: string,
  index: number,
  density: "normal" | "compact",
  deckTitle?: string
): string {
  const left = deckTitle ? escapeHtml(clampText(stripUnsafe(deckTitle), 40)) : "";
  return `
<section class="slide" data-density="${density}">
  <div class="safe">${inner}
  </div>
  <div class="footer"><div>${left}</div><div>${index + 1}</div></div>
</section>`;
}

export function outlineToSimpleSlides(outline: Outline): string {
  // Back-compat: now uses the same design system renderer.
  return outlineToStyledSlides(outline);
}

export function outlineToStyledSlides(outline: Outline): string {
  const slides = Array.isArray(outline?.slides) ? outline.slides : [];

  return slides
    .map((s, i) => {
      const type = normalizeSlideType(s?.slideType);

      if (type === "title") {
        const title = clampText(stripUnsafe(outline?.title || s?.title || ""), 90);
        const subtitle = clampText(stripUnsafe(outline?.overallTheme || ""), 140);
        const kicker = clampText(stripUnsafe("Presentation"), 36);
        const header = renderHeader({ kicker, title, subtitle: subtitle || undefined });
        const body = `<div class="body"><div class="card"><p class="subtitle">${escapeHtml(clampText(stripUnsafe(s?.notes || ""), 200))}</p></div></div>`;
        const density: "normal" | "compact" = "normal";
        return renderSlideSection(`${header}${body}`, i, density, outline?.title);
      }

      if (type === "comparison") {
        const title = clampText(stripUnsafe(s?.title || ""), 90);
        const kicker = pickKicker(s, outline);
        const { leftTitle, rightTitle, leftBullets, rightBullets } = parseComparison(s);
        const density = computeDensity([...leftBullets, ...rightBullets]);

        const left = renderBullets(leftBullets, 5);
        const right = renderBullets(rightBullets, 5);

        const header = renderHeader({ kicker, title });
        const body = `
  <div class="body">
    <div class="grid-2">
      <div class="card">
        <h3 class="card-title">${escapeHtml(clampText(stripUnsafe(leftTitle), 26))}</h3>
        ${left.html}
        ${left.overflowNote}
      </div>
      <div class="card">
        <h3 class="card-title">${escapeHtml(clampText(stripUnsafe(rightTitle), 26))}</h3>
        ${right.html}
        ${right.overflowNote}
      </div>
    </div>
  </div>`;

        return renderSlideSection(`${header}${body}`, i, density, outline?.title);
      }

      if (type === "quote") {
        const title = clampText(stripUnsafe(s?.title || "Quote"), 90);
        const kicker = pickKicker(s, outline);
        const bullets = normalizeBullets(s?.content, 3, 220);
        const quoteText = clampText(stripUnsafe(bullets[0] || ""), 220);
        const attributionRaw = bullets[1] || "";
        const attribution = attributionRaw ? clampText(stripUnsafe(attributionRaw.replace(/^[\-—]\s*/, "")), 80) : "";

        const density: "normal" | "compact" = quoteText.length > 150 ? "compact" : "normal";
        const header = renderHeader({ kicker, title });
        const body = `
  <div class="body">
    <div class="card">
      <div class="quote">${escapeHtml(quoteText || "—")}</div>
      ${attribution ? `<div class="quote-by">${escapeHtml(attribution)}</div>` : ""}
    </div>
  </div>`;
        return renderSlideSection(`${header}${body}`, i, density, outline?.title);
      }

      if (type === "imagePlaceholder") {
        const title = clampText(stripUnsafe(s?.title || ""), 90);
        const kicker = pickKicker(s, outline);
        const bullets = normalizeBullets(s?.content, 6, 120);
        const density = computeDensity(bullets);
        const b = renderBullets(bullets, density === "compact" ? 8 : 6);

        const header = renderHeader({ kicker, title });
        const body = `
  <div class="body">
    <div class="grid-2">
      <div class="placeholder">${escapeHtml(clampText(stripUnsafe("Visual placeholder"), 60))}<br/>${escapeHtml(clampText(stripUnsafe(title), 60))}</div>
      <div class="card">
        <h3 class="card-title">What the visual should convey</h3>
        ${b.html}
        ${b.overflowNote}
      </div>
    </div>
  </div>`;
        return renderSlideSection(`${header}${body}`, i, density, outline?.title);
      }

      // content (default)
      const title = clampText(stripUnsafe(s?.title || ""), 90);
      const kicker = pickKicker(s, outline);
      const bullets = normalizeBullets(s?.content, 12, 120);
      const density = computeDensity(bullets);
      const maxBullets = density === "compact" ? 8 : 6;
      const b = renderBullets(bullets, maxBullets);
      const header = renderHeader({ kicker, title });
      const body = `
  <div class="body">
    <div class="card">
      ${b.html}
      ${b.overflowNote}
    </div>
  </div>`;
      return renderSlideSection(`${header}${body}`, i, density, outline?.title);
    })
    .join("\n");
}

/**
 * Legacy name kept for the /export-pdf pipeline.
 * We still accept an anthropicJsonRequest function, but we no longer let the AI produce arbitrary HTML.
 */
export async function outlineToAiSlides(
  outline: Outline,
  _anthropicJsonRequest: (cacheKey: string, system: string, user: string, maxTokens?: number) => Promise<any>,
  _options?: { concurrency?: number }
): Promise<string> {
  // Deterministic, stable rendering based on outline only.
  return outlineToStyledSlides(outline);
}
