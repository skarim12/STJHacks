import { getVariantByName, type LayoutVariant } from "./layoutVariants";

export type Slide = {
  title?: string;
  slideType?: string;
  content?: string[];
  notes?: string;
  suggestedLayout?: string;
  // Optional user-provided description (for images/layout hints)
  describe?: string;
  // Optional slide look preset
  look?: "default" | "light" | "dark" | "bold";
  // Optional embedded image (data URI). Only set when explicitly enabled.
  imageDataUri?: string;
  imageCredit?: string;
  imageSourcePage?: string;
  // Always-on layout plan (set by backend). Renderer uses this to place boxes.
  layoutPlan?: { variant: string };

  // Optional per-slide styling + shapes (set by backend).
  stylePlan?: any;
};

export type Outline = {
  title?: string;
  overallTheme?: string;
  // Optional deck-level description (for image/layout hints)
  describe?: string;
  // Optional deck look preset
  look?: "default" | "light" | "dark" | "bold";
  // Optional theme styling beyond colors
  themeStyle?: {
    background?: { kind?: "solid" | "gradient" | "vignette" };
    panels?: { kind?: "glass" | "solid" | "none" };
    accents?: { kind?: "divider" | "bars" | "minimal" };
    mood?: "minimal" | "bold" | "classic";
  };
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

function computeDensity(bullets: string[]): "normal" | "compact" | "dense" {
  const totalLen = bullets.reduce((a, b) => a + b.length, 0);
  if (bullets.length > 8) return "dense";
  if (totalLen > 850) return "dense";
  if (bullets.some((b) => b.length > 140)) return "dense";
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

function cssVarsFromOutline(outline: Outline): {
  bg: string;
  text: string;
  accent: string;
  accent2: string;
  isLightBg: boolean;
} {
  const themeStyle = outline?.themeStyle && typeof outline.themeStyle === "object" ? (outline as any).themeStyle : {};

  const bg0 = String(outline?.colorScheme?.background || "#0b1220");
  const text = String(outline?.colorScheme?.text || "#ffffff");
  const accent = String(outline?.colorScheme?.accent || outline?.colorScheme?.primary || "#6ee7ff");
  const accent2 = String(outline?.colorScheme?.secondary || "#a78bfa");

  // Allow CSS gradients for background (Puppeteer-safe; no runtime randomness).
  const bg = String(themeStyle?.background || "solid") === "subtleGradient"
    ? `radial-gradient(1200px 700px at 18% 22%, ${accent}22, transparent 62%), radial-gradient(1000px 650px at 82% 82%, ${accent2}1f, transparent 60%), ${bg0}`
    : bg0;

  const hexToRgb = (h: string): { r: number; g: number; b: number } | null => {
    const m = String(h).trim().match(/^#?([0-9a-f]{6})$/i);
    if (!m) return null;
    const x = m[1];
    return {
      r: parseInt(x.slice(0, 2), 16),
      g: parseInt(x.slice(2, 4), 16),
      b: parseInt(x.slice(4, 6), 16),
    };
  };

  const rgb = hexToRgb(bg);
  const luminance = rgb
    ? (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
    : 0;
  const isLightBg = luminance > 0.72;

  return { bg, text, accent, accent2, isLightBg };
}

// Shared CSS: one HTML doc with multiple .slide pages.
export function wrapDeckHtml(slideHtml: string, outline: Outline): string {
  const { bg, text, accent, accent2, isLightBg } = cssVarsFromOutline(outline);
  const themeBgKind = String((outline as any)?.themeStyle?.background?.kind || "solid").toLowerCase();
  const themePanelsKind = String((outline as any)?.themeStyle?.panels?.kind || "glass").toLowerCase();
  const themeAccentsKind = String((outline as any)?.themeStyle?.accents?.kind || "divider").toLowerCase();
  const themeMood = String((outline as any)?.themeStyle?.mood || "classic").toLowerCase();

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

      --title: 62px;
      --subtitle: 34px;
      --kicker: 20px;
      --body: 26px;
      --small: 20px;

      --lh-title: 1.08;
      --lh-body: 1.25;

      --w-regular: 400;
      --w-medium: 600;
      --w-bold: 750;

      --tracking-kicker: .14em;

      --bg: ${bg};
      --text: ${text};
      --muted: ${isLightBg ? "rgba(0,0,0,.62)" : "rgba(255,255,255,.72)"};
      --faint: ${isLightBg ? "rgba(0,0,0,.42)" : "rgba(255,255,255,.48)"};

      --panel: ${(() => {
        const p = String((outline as any)?.themeStyle?.panels || "glass");
        if (p === "flat") return isLightBg ? "rgba(0,0,0,.03)" : "rgba(255,255,255,.05)";
        return isLightBg ? "rgba(0,0,0,.04)" : "rgba(255,255,255,.06)";
      })()};
      --panel-2: ${(() => {
        const p = String((outline as any)?.themeStyle?.panels || "glass");
        if (p === "flat") return isLightBg ? "rgba(0,0,0,.055)" : "rgba(255,255,255,.085)";
        return isLightBg ? "rgba(0,0,0,.07)" : "rgba(255,255,255,.10)";
      })()};

      --accent: ${accent};
      --accent-2: ${accent2};
      --stroke-color: ${isLightBg ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.12)"};

      --theme-bg-kind: ${escapeHtml(themeBgKind)};
      --theme-panels-kind: ${escapeHtml(themePanelsKind)};
      --theme-accents-kind: ${escapeHtml(themeAccentsKind)};
      --theme-mood: ${escapeHtml(themeMood)};
    }

    body{ font-family: var(--font-sans); color: var(--text); }

    /* Look presets (simple, deterministic). */
    .slide[data-look="light"]{
      --bg: #ffffff;
      --text: #0b1220;
      --muted: rgba(11,18,32,.62);
      --faint: rgba(11,18,32,.42);
      --panel: rgba(11,18,32,.04);
      --panel-2: rgba(11,18,32,.07);
      --stroke-color: rgba(11,18,32,.10);
    }

    .slide[data-look="dark"]{
      /* use whatever outline.bg/text are, just strengthen panels */
      --panel: rgba(255,255,255,.07);
      --panel-2: rgba(255,255,255,.12);
      --stroke-color: rgba(255,255,255,.14);
    }

    .slide[data-look="bold"]{
      --title: 66px;
      --body: 27px;
      --panel: rgba(255,255,255,.08);
      --stroke-color: rgba(255,255,255,.18);
    }

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

    /* Background treatments (themeStyle.background.kind) */
    .slide[data-look]{
      /* nothing; data-look used elsewhere */
    }

    .slide::before{
      content:"";
      position:absolute;
      inset:0;
      z-index:0;
      pointer-events:none;
      background: transparent;
    }

    .slide[data-theme-bg="gradient"]::before{
      background: radial-gradient(1200px 700px at 20% 10%, rgba(255,255,255,.08), transparent 60%),
                  radial-gradient(1200px 700px at 80% 90%, rgba(255,255,255,.06), transparent 55%);
      opacity: .9;
    }

    .slide[data-theme-bg="vignette"]::before{
      background: radial-gradient(900px 600px at 35% 30%, rgba(255,255,255,.08), transparent 60%),
                  radial-gradient(1000px 700px at 60% 60%, transparent 40%, rgba(0,0,0,.35) 100%);
      opacity: .95;
    }

    .slide[data-density="compact"]{
      --body: 23px;
      --row-gap: 20px;
      --gutter: 40px;
    }

    .slide[data-density="dense"]{
      --title: 56px;
      --subtitle: 30px;
      --body: 22px;
      --row-gap: 18px;
      --gutter: 36px;
    }

    .safe{
      margin: var(--margin-y) var(--margin-x);
      width: calc(var(--slide-w) - 2*var(--margin-x));
      height: calc(var(--slide-h) - 2*var(--margin-y));
      display: flex;
      flex-direction: column;
      gap: var(--row-gap);
      min-height: 0;
      position: relative;
    }

    /* Decorative shapes live behind main content, within the safe area. */
    .decor{
      position:absolute;
      inset:0;
      pointer-events:none;
      z-index: 0;
    }

    .shape{ position:absolute; }

    .layout-grid{ position: relative; z-index: 1; }

    /* Grid-based planned layouts (always-on). */
    .layout-grid{
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      grid-template-rows: repeat(8, 1fr);
      column-gap: var(--gutter);
      row-gap: var(--row-gap);
      align-items: stretch;
    }

    .box{ min-width: 0; min-height: 0; }

    .accent-bar{
      width:100%;
      height:100%;
      border-radius: 16px;
      background: linear-gradient(180deg, var(--accent), var(--accent-2));
      opacity: .92;
      box-shadow: 0 14px 40px rgba(0,0,0,.18);
    }

    .statement{
      font-size: 56px;
      line-height: 1.12;
      font-weight: var(--w-bold);
      letter-spacing: -0.01em;
      margin: 0;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 4;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .fullbleed{
      position:absolute;
      inset:0;
      z-index:0;
    }

    .fullbleed img{
      width:100%;
      height:100%;
      object-fit: cover;
      display:block;
      filter: saturate(1.05) contrast(1.05);
    }

    .fullbleed::after{
      content:"";
      position:absolute;
      inset:0;
      background: linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55));
      pointer-events:none;
    }

    .safe{ z-index: 1; }

    .header{ display:flex; flex-direction:column; gap:14px; }

    .kicker{
      font-size: var(--kicker);
      letter-spacing: var(--tracking-kicker);
      text-transform: uppercase;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .title{
      font-size: var(--title);
      font-weight: var(--w-bold);
      line-height: var(--lh-title);
      margin: 0;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .subtitle{
      font-size: var(--subtitle);
      font-weight: var(--w-medium);
      color: var(--muted);
      line-height: 1.15;
      margin: 0;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      text-overflow: ellipsis;
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
      padding: 38px 40px;
      box-shadow: var(--shadow-1);
      display:flex;
      flex-direction:column;
      gap: 18px;
      min-height: 0;
    }

    .card.accent{
      border-color: rgba(255,255,255,.18);
      background: linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.04));
    }

    .image-frame{
      width: 100%;
      height: 100%;
      border-radius: var(--r-lg);
      overflow: hidden;
      border: var(--stroke) solid rgba(255,255,255,.14);
      background: rgba(0,0,0,.18);
      display:flex;
      align-items:center;
      justify-content:center;
      position: relative;
    }

    /* Consistent treatment across sources (Wikimedia/OpenAI) so decks feel cohesive. */
    .image-frame::after{
      content:"";
      position:absolute;
      inset:0;
      background: linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.26));
      pointer-events:none;
    }

    .image-frame img{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display:block;
      filter: saturate(1.05) contrast(1.05);
    }

    .image-credit{
      font-size: 18px;
      color: var(--faint);
      margin-top: 10px;
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

function styleAttrFromPlan(plan: any, key: "title" | "subtitle" | "kicker" | "body"): string {
  const p = plan && typeof plan === "object" ? (plan as any)[key] : null;
  if (!p || typeof p !== "object") return "";

  const css: string[] = [];
  const ff = String((p as any).fontFace || "").trim();
  if (ff) css.push(`font-family:${escapeHtml(ff)}, var(--font-sans)`);
  const fs = Number((p as any).fontSize);
  if (Number.isFinite(fs) && fs > 0) css.push(`font-size:${Math.round(fs)}px`);
  const col = String((p as any).color || "").trim();
  if (/^#?[0-9a-f]{6}$/i.test(col)) css.push(`color:${col.startsWith("#") ? col : `#${col}`}`);
  const w = String((p as any).weight || "").toLowerCase().trim();
  if (w === "regular") css.push(`font-weight:400`);
  if (w === "medium") css.push(`font-weight:600`);
  if (w === "bold") css.push(`font-weight:750`);

  return css.length ? ` style="${css.join(";")}"` : "";
}

function renderShapes(plan: any): string {
  const shapes = plan && typeof plan === "object" ? (plan as any).shapes : null;
  if (!Array.isArray(shapes) || !shapes.length) return "";

  const renderRect = (s: any): string => {
    const x = Math.max(0, Math.min(1, Number(s?.x ?? 0)));
    const y = Math.max(0, Math.min(1, Number(s?.y ?? 0)));
    const w = Math.max(0, Math.min(1, Number(s?.w ?? 0.2)));
    const h = Math.max(0, Math.min(1, Number(s?.h ?? 0.1)));
    const fill = String(s?.fill || "").trim();
    const stroke = String(s?.stroke || "").trim();
    const sw = Number(s?.strokeWidth ?? 0);
    const r = Number(s?.radius ?? 0);
    const op = Math.max(0, Math.min(1, Number(s?.opacity ?? 1)));

    const styles: string[] = [
      `left:${(x * 100).toFixed(2)}%`,
      `top:${(y * 100).toFixed(2)}%`,
      `width:${(w * 100).toFixed(2)}%`,
      `height:${(h * 100).toFixed(2)}%`,
      `opacity:${op.toFixed(3)}`,
      `border-radius:${Math.max(0, Math.min(80, r))}px`,
    ];
    if (/^#?[0-9a-f]{6}$/i.test(fill)) styles.push(`background:${fill.startsWith("#") ? fill : `#${fill}`}`);
    if (/^#?[0-9a-f]{6}$/i.test(stroke) && Number.isFinite(sw) && sw > 0) {
      styles.push(`border:${Math.round(sw)}px solid ${stroke.startsWith("#") ? stroke : `#${stroke}`}`);
    }

    return `<div class="shape" style="${styles.join(";")}"></div>`;
  };

  const renderLine = (s: any): string => {
    const x1 = Math.max(0, Math.min(1, Number(s?.x1 ?? 0)));
    const y1 = Math.max(0, Math.min(1, Number(s?.y1 ?? 0)));
    const x2 = Math.max(0, Math.min(1, Number(s?.x2 ?? 0.4)));
    const y2 = Math.max(0, Math.min(1, Number(s?.y2 ?? 0)));
    const stroke = String(s?.stroke || "").trim();
    const sw = Number(s?.strokeWidth ?? 4);
    const op = Math.max(0, Math.min(1, Number(s?.opacity ?? 1)));

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const color = /^#?[0-9a-f]{6}$/i.test(stroke) ? (stroke.startsWith("#") ? stroke : `#${stroke}`) : "var(--accent)";

    const styles: string[] = [
      `left:${(x1 * 100).toFixed(2)}%`,
      `top:${(y1 * 100).toFixed(2)}%`,
      `width:${(len * 100).toFixed(2)}%`,
      `height:${Math.max(1, Math.min(18, Math.round(sw)))}px`,
      `background:${color}`,
      `opacity:${op.toFixed(3)}`,
      `transform-origin: 0 0`,
      `transform: rotate(${angle.toFixed(3)}deg)`,
    ];

    return `<div class="shape" style="${styles.join(";")}"></div>`;
  };

  const html = shapes
    .slice(0, 12)
    .map((s: any) => {
      const k = String(s?.kind || "").toLowerCase();
      if (k === "rect") return renderRect(s);
      if (k === "line") return renderLine(s);
      return "";
    })
    .join("");

  return html ? `<div class="decor">${html}</div>` : "";
}

function renderHeader(opts: { kicker?: string; title: string; subtitle?: string; stylePlan?: any }): string {
  const kicker = opts.kicker ? `<div class="kicker"${styleAttrFromPlan(opts.stylePlan, "kicker")}>${escapeHtml(opts.kicker)}</div>` : "";
  const subtitle = opts.subtitle ? `<p class="subtitle"${styleAttrFromPlan(opts.stylePlan, "subtitle")}>${escapeHtml(opts.subtitle)}</p>` : "";
  return `
  <div class="header">
    ${kicker}
    <h1 class="title"${styleAttrFromPlan(opts.stylePlan, "title")}>${escapeHtml(opts.title)}</h1>
    ${subtitle}
  </div>
  <div class="divider"></div>`;
}

function gridStyle(rect: { colStart: number; colSpan: number; rowStart: number; rowSpan: number }): string {
  const cs = Math.max(1, Math.min(12, rect.colStart));
  const cspan = Math.max(1, Math.min(12, rect.colSpan));
  const rs = Math.max(1, Math.min(8, rect.rowStart));
  const rspan = Math.max(1, Math.min(8, rect.rowSpan));
  return `grid-column:${cs} / span ${cspan}; grid-row:${rs} / span ${rspan};`;
}

function normalizePlannedSlideType(t: unknown): "title" | "content" | "comparison" | "quote" | "imagePlaceholder" {
  const s = String(t ?? "").toLowerCase().trim();
  if (s === "title") return "title";
  if (s === "comparison") return "comparison";
  if (s === "quote") return "quote";
  if (s === "image" || s === "imageplaceholder" || s === "image-placeholder") return "imagePlaceholder";
  return "content";
}

function plannedVariantForSlide(s: Slide): LayoutVariant | null {
  const name = String(s?.layoutPlan?.variant || "").trim();
  if (!name) return null;
  const v = getVariantByName(name);
  if (!v) return null;

  const t = normalizePlannedSlideType(s?.slideType);
  if (!(v.slideTypes as any).includes(t)) return null;
  return v;
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
  opts: {
    safeInner: string;
    outer?: string;
    themeBgKind?: "solid" | "gradient" | "vignette";
  },
  index: number,
  density: "normal" | "compact" | "dense",
  deckTitle?: string,
  look?: string
): string {
  const left = deckTitle ? escapeHtml(clampText(stripUnsafe(deckTitle), 40)) : "";
  const dataLook = escapeHtml(String(look || "default"));
  const themeBgKind = escapeHtml(String(((opts as any).themeBgKind || "solid")).toLowerCase());
  return `
<section class="slide" data-density="${density}" data-look="${dataLook}" data-theme-bg="${themeBgKind}">
  ${opts.outer || ""}
  <div class="safe">${opts.safeInner}
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

  const renderPlanned = (s: Slide, i: number): string | null => {
    const variant = plannedVariantForSlide(s);
    if (!variant) return null;

    const type = normalizePlannedSlideType(s?.slideType);
    const deckTitle = outline?.title;

    const title = clampText(stripUnsafe(type === "title" ? outline?.title || s?.title || "" : s?.title || ""), 90);
    const kicker = clampText(stripUnsafe(type === "title" ? "Presentation" : pickKicker(s, outline)), 36);
    const subtitle = type === "title" ? clampText(stripUnsafe(outline?.overallTheme || ""), 140) : "";

    const bullets = normalizeBullets(s?.content, 12, 120);
    const density = computeDensity(bullets);
    const maxBullets = density === "dense" ? 9 : density === "compact" ? 8 : 6;
    const b = renderBullets(bullets, maxBullets);

    const { leftTitle, rightTitle, leftBullets, rightBullets } = type === "comparison" ? parseComparison(s) : ({} as any);
    const left = type === "comparison" ? renderBullets(leftBullets, 5) : null;
    const right = type === "comparison" ? renderBullets(rightBullets, 5) : null;

    const quoteBullets = type === "quote" ? normalizeBullets(s?.content, 3, 220) : [];
    const quoteText = type === "quote" ? clampText(stripUnsafe(quoteBullets[0] || ""), 220) : "";
    const attributionRaw = type === "quote" ? quoteBullets[1] || "" : "";
    const attribution = attributionRaw ? clampText(stripUnsafe(attributionRaw.replace(/^[\-—]\s*/, "")), 80) : "";

    const imageHtml = s?.imageDataUri
      ? `<div class="card accent"><div class="image-frame"><img alt="" src="${escapeHtml(s.imageDataUri)}" /></div>${
          s?.imageCredit ? `<div class="image-credit">${escapeHtml(s.imageCredit)}</div>` : ""
        }</div>`
      : `<div class="placeholder">${escapeHtml(clampText(stripUnsafe("Visual placeholder"), 60))}<br/>${escapeHtml(clampText(stripUnsafe(title), 60))}</div>`;

    const headerHtml = renderHeader({ kicker, title, subtitle: subtitle || undefined, stylePlan: (s as any)?.stylePlan });
    const bodyStyle = styleAttrFromPlan((s as any)?.stylePlan, "body");
    const bulletsCard = `<div class="card"${bodyStyle}>${b.html}${b.overflowNote}</div>`;
    const quoteCard = `<div class="card"><div class="quote">${escapeHtml(quoteText || "—")}</div>${
      attribution ? `<div class="quote-by">${escapeHtml(attribution)}</div>` : ""
    }</div>`;

    const comparisonLeftCard = `<div class="card"><h3 class="card-title">${escapeHtml(clampText(stripUnsafe(leftTitle || "Option A"), 26))}</h3>${
      left ? `${left.html}${left.overflowNote}` : ""
    }</div>`;
    const comparisonRightCard = `<div class="card"><h3 class="card-title">${escapeHtml(clampText(stripUnsafe(rightTitle || "Option B"), 26))}</h3>${
      right ? `${right.html}${right.overflowNote}` : ""
    }</div>`;

    const bulletBoxes = variant.boxes.filter((b) => b.kind === "bulletsCard");
    const parts = (() => {
      const n = Math.max(1, Math.min(3, bulletBoxes.length || 1));
      const out: string[][] = Array.from({ length: n }, () => []);
      // Balanced split: 0,1,2,0,1,2...
      for (let j = 0; j < bullets.length; j++) out[j % n].push(bullets[j]);
      return out;
    })();

    const bulletsCardFor = (partIndex: number): string => {
      const maxPerCard = bulletBoxes.length > 1 ? (density === "dense" ? 5 : density === "compact" ? 6 : 6) : maxBullets;
      const bb = renderBullets(parts[partIndex] || [], maxPerCard);
      return `<div class="card"${bodyStyle}>${bb.html}${bb.overflowNote}</div>`;
    };

    const statementText = clampText(stripUnsafe(bullets[0] || s?.notes || s?.describe || ""), 220);
    const statementCard = `<div class="card accent"${bodyStyle}><p class="statement">${escapeHtml(statementText || title || "Statement")}</p></div>`;

    const isFullBleed = variant.boxes.some((b) => b.kind === "fullBleedImage");
    const fullBleedOuter = isFullBleed && s?.imageDataUri
      ? `<div class="fullbleed"><img alt="" src="${escapeHtml(s.imageDataUri)}" /></div>`
      : "";

    let bulletPartCursor = 0;

    const boxesHtml = variant.boxes
      .filter((b) => b.kind !== "fullBleedImage")
      .map((box) => {
        const style = gridStyle(box.rect);
        let inner = "";
        switch (box.kind) {
          case "header":
            inner = headerHtml;
            break;
          case "bulletsCard":
            inner = bulletsCardFor(Math.min(parts.length - 1, bulletPartCursor++));
            break;
          case "imageCard":
            inner = imageHtml;
            break;
          case "quoteCard":
            inner = quoteCard;
            break;
          case "comparisonLeft":
            inner = comparisonLeftCard;
            break;
          case "comparisonRight":
            inner = comparisonRightCard;
            break;
          case "statementCard":
            inner = statementCard;
            break;
          case "accentBar":
            inner = `<div class="accent-bar"></div>`;
            break;
          default:
            inner = bulletsCard;
        }
        return `<div class="box" style="${style}">${inner}</div>`;
      })
      .join("");

    const decor = renderShapes((s as any)?.stylePlan);
    const safeInner = `${decor}<div class="layout-grid">${boxesHtml}</div>`;
    const look = (s as any)?.look || (outline as any)?.look || "default";
    return renderSlideSection({ safeInner, outer: fullBleedOuter, themeBgKind: themeBgKind as any }, i, density, deckTitle, look);
  };

  return slides
    .map((s, i) => {
      const planned = renderPlanned(s as any, i);
      if (planned) return planned;

      // Fallback: old deterministic renderer if no layoutPlan was attached.
      const type = normalizeSlideType(s?.slideType);

      if (type === "title") {
        const title = clampText(stripUnsafe(outline?.title || s?.title || ""), 90);
        const subtitle = clampText(stripUnsafe(outline?.overallTheme || ""), 140);
        const kicker = clampText(stripUnsafe("Presentation"), 36);
        const header = renderHeader({ kicker, title, subtitle: subtitle || undefined });
        const body = `<div class="body"><div class="card"><p class="subtitle">${escapeHtml(clampText(stripUnsafe(s?.notes || ""), 200))}</p></div></div>`;
        const density: "normal" | "compact" | "dense" = "normal";
        return renderSlideSection({ safeInner: `${header}${body}`, themeBgKind: themeBgKind as any }, i, density, outline?.title, (s as any)?.look || (outline as any)?.look || "default");
      }

      // Keep prior fallback logic for non-planned slides.
      const title = clampText(stripUnsafe(s?.title || ""), 90);
      const kicker = pickKicker(s, outline);
      const bullets = normalizeBullets(s?.content, 12, 120);
      const density = computeDensity(bullets);
      const maxBullets = density === "dense" ? 9 : density === "compact" ? 8 : 6;
      const b = renderBullets(bullets, maxBullets);
      const header = renderHeader({ kicker, title });
      const body = `
  <div class="body">
    <div class="card">
      ${b.html}
      ${b.overflowNote}
    </div>
  </div>`;

      return renderSlideSection({ safeInner: `${header}${body}`, themeBgKind: themeBgKind as any }, i, density, outline?.title, (s as any)?.look || (outline as any)?.look || "default");
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
