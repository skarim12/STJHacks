import type { Outline } from "./deckHtml";
import { getVariantByName } from "./layoutVariants";

export type TextStylePlan = {
  fontFace?: "Calibri" | "Segoe UI" | "Arial";
  fontSize?: number; // px for HTML; PPTX will map
  color?: string; // #RRGGBB
  weight?: "regular" | "medium" | "bold";
};

export type ShapePlan =
  | {
      kind: "rect";
      // normalized coordinates within the SAFE area (0..1)
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string; // #RRGGBB
      stroke?: string; // #RRGGBB
      strokeWidth?: number; // px
      radius?: number; // px
      opacity?: number; // 0..1
    }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
    };

export type SlideStylePlan = {
  look?: "default" | "light" | "dark" | "bold";
  title?: TextStylePlan;
  kicker?: TextStylePlan;
  subtitle?: TextStylePlan;
  body?: TextStylePlan;
  shapes?: ShapePlan[];
};

export type StyleEnrichmentOptions = {
  anthropicJsonRequest: (cacheKey: string, system: string, user: string, maxTokens?: number) => Promise<any>;
};

function clamp01(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function clampNum(n: any, min: number, max: number, fallback: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function normHex(h: any): string | undefined {
  const s = String(h || "").trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return undefined;
  return `#${m[1].toLowerCase()}`;
}

function normFontFace(f: any): TextStylePlan["fontFace"] | undefined {
  const s = String(f || "").toLowerCase().trim();
  if (s === "calibri") return "Calibri";
  if (s === "segoe ui" || s === "segoe") return "Segoe UI";
  if (s === "arial") return "Arial";
  return undefined;
}

function normWeight(w: any): TextStylePlan["weight"] | undefined {
  const s = String(w || "").toLowerCase().trim();
  if (s === "regular" || s === "400") return "regular";
  if (s === "medium" || s === "600") return "medium";
  if (s === "bold" || s === "700" || s === "750") return "bold";
  return undefined;
}

function sanitizeTextStyle(input: any, kind: "title" | "subtitle" | "kicker" | "body"): TextStylePlan | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: TextStylePlan = {};
  out.fontFace = normFontFace((input as any).fontFace);
  out.color = normHex((input as any).color);
  out.weight = normWeight((input as any).weight);

  const fs = (input as any).fontSize;
  if (fs != null) {
    const [min, max, fallback] =
      kind === "title"
        ? [44, 78, 62]
        : kind === "subtitle"
          ? [24, 44, 34]
          : kind === "kicker"
            ? [14, 26, 20]
            : [18, 34, 26];
    out.fontSize = clampNum(fs, min, max, fallback);
  }

  if (!out.fontFace && !out.color && !out.weight && out.fontSize == null) return undefined;
  return out;
}

function sanitizeShapes(input: any): ShapePlan[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: ShapePlan[] = [];

  for (const s of input.slice(0, 12)) {
    if (!s || typeof s !== "object") continue;
    const kind = String((s as any).kind || "").toLowerCase();
    if (kind === "rect") {
      out.push({
        kind: "rect",
        x: clamp01((s as any).x),
        y: clamp01((s as any).y),
        w: clampNum((s as any).w, 0.02, 1, 0.2),
        h: clampNum((s as any).h, 0.02, 1, 0.1),
        fill: normHex((s as any).fill),
        stroke: normHex((s as any).stroke),
        strokeWidth: clampNum((s as any).strokeWidth, 0, 12, 2),
        radius: clampNum((s as any).radius, 0, 80, 20),
        opacity: clampNum((s as any).opacity, 0, 1, 1),
      });
    } else if (kind === "line") {
      out.push({
        kind: "line",
        x1: clamp01((s as any).x1),
        y1: clamp01((s as any).y1),
        x2: clamp01((s as any).x2),
        y2: clamp01((s as any).y2),
        stroke: normHex((s as any).stroke),
        strokeWidth: clampNum((s as any).strokeWidth, 1, 18, 4),
        opacity: clampNum((s as any).opacity, 0, 1, 1),
      });
    }
  }

  return out.length ? out : undefined;
}

function sanitizeSlideStyle(input: any): SlideStylePlan | undefined {
  if (!input || typeof input !== "object") return undefined;
  const out: SlideStylePlan = {};

  const look = String((input as any).look || "").toLowerCase().trim();
  if (look === "default" || look === "light" || look === "dark" || look === "bold") out.look = look as any;

  out.title = sanitizeTextStyle((input as any).title, "title");
  out.subtitle = sanitizeTextStyle((input as any).subtitle, "subtitle");
  out.kicker = sanitizeTextStyle((input as any).kicker, "kicker");
  out.body = sanitizeTextStyle((input as any).body, "body");
  out.shapes = sanitizeShapes((input as any).shapes);

  if (!out.look && !out.title && !out.subtitle && !out.kicker && !out.body && !out.shapes) return undefined;
  return out;
}

type Rect01 = { x: number; y: number; w: number; h: number };

function rectsIntersect(a: Rect01, b: Rect01): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function inflateRect(r: Rect01, pad: number): Rect01 {
  const p = Math.max(0, Math.min(0.25, pad));
  const x = Math.max(0, r.x - p);
  const y = Math.max(0, r.y - p);
  const w = Math.min(1 - x, r.w + 2 * p);
  const h = Math.min(1 - y, r.h + 2 * p);
  return { x, y, w, h };
}

function gridRectTo01(rect: { colStart: number; colSpan: number; rowStart: number; rowSpan: number }): Rect01 {
  // Variant grid is 12 cols x 8 rows inside safe area.
  const cs = Math.max(1, Math.min(12, Number(rect.colStart || 1)));
  const cspan = Math.max(1, Math.min(12, Number(rect.colSpan || 12)));
  const rs = Math.max(1, Math.min(8, Number(rect.rowStart || 1)));
  const rspan = Math.max(1, Math.min(8, Number(rect.rowSpan || 8)));

  const x = (cs - 1) / 12;
  const w = cspan / 12;
  const y = (rs - 1) / 8;
  const h = rspan / 8;

  return { x, y, w, h };
}

function exclusionZonesForSlide(slide: any): Rect01[] {
  const variantName = String(slide?.layoutPlan?.variant || "").trim();
  const v = variantName ? getVariantByName(variantName) : null;
  if (!v) return [];

  // Exclude any region with text-heavy content.
  const excludedKinds = new Set(["header", "bulletsCard", "quoteCard", "comparisonLeft", "comparisonRight", "statementCard"]);

  const zones = v.boxes
    .filter((b) => excludedKinds.has(b.kind as any))
    .map((b) => inflateRect(gridRectTo01(b.rect), 0.02));

  return zones;
}

function shapeBounds01(sh: any): Rect01 | null {
  const kind = String(sh?.kind || "").toLowerCase();
  if (kind === "rect") {
    const x = clamp01(sh?.x);
    const y = clamp01(sh?.y);
    const w = clampNum(sh?.w, 0.02, 1, 0.2);
    const h = clampNum(sh?.h, 0.02, 1, 0.1);
    return { x, y, w, h };
  }
  if (kind === "line") {
    const x1 = clamp01(sh?.x1);
    const y1 = clamp01(sh?.y1);
    const x2 = clamp01(sh?.x2);
    const y2 = clamp01(sh?.y2);
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.max(0.002, Math.abs(x2 - x1));
    const h = Math.max(0.002, Math.abs(y2 - y1));
    return inflateRect({ x, y, w, h }, 0.01);
  }
  return null;
}

function filterShapesAgainstZones(shapes: ShapePlan[] | undefined, zones: Rect01[]): ShapePlan[] | undefined {
  if (!shapes?.length || !zones.length) return shapes;

  const kept: ShapePlan[] = [];
  for (const sh of shapes) {
    const b = shapeBounds01(sh);
    if (!b) continue;
    const hit = zones.some((z) => rectsIntersect(b, z));
    if (!hit) kept.push(sh);
  }

  return kept.length ? kept : undefined;
}

function simpleHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export async function enrichOutlineWithStyles(outline: any, opts: StyleEnrichmentOptions) {
  const slides: any[] = Array.isArray(outline?.slides) ? outline.slides : [];
  const deckTitle = String(outline?.title || "").slice(0, 80);
  const deckDescribe = String(outline?.describe || "").slice(0, 280);
  const deckLook = String(outline?.look || "default");
  const themePrompt = String((outline as any)?.themePrompt || "").slice(0, 400);
  const decoratePrompt = String((outline as any)?.decoratePrompt || "").slice(0, 400);

  const system = `You are a slide stylist and illustrator.

Return STRICT JSON only with this schema:
{
  "slides": [
    {
      "index": 0,
      "style": {
        "look": "default|light|dark|bold",
        "title": {"fontFace":"Calibri|Segoe UI|Arial","fontSize":62,"color":"#RRGGBB","weight":"regular|medium|bold"},
        "subtitle": {"fontFace":"Calibri|Segoe UI|Arial","fontSize":34,"color":"#RRGGBB","weight":"regular|medium|bold"},
        "kicker": {"fontFace":"Calibri|Segoe UI|Arial","fontSize":20,"color":"#RRGGBB","weight":"regular|medium|bold"},
        "body": {"fontFace":"Calibri|Segoe UI|Arial","fontSize":26,"color":"#RRGGBB","weight":"regular|medium|bold"},
        "shapes": [
          {"kind":"rect","x":0.05,"y":0.06,"w":0.90,"h":0.02,"fill":"#RRGGBB","opacity":1},
          {"kind":"line","x1":0.08,"y1":0.22,"x2":0.45,"y2":0.22,"stroke":"#RRGGBB","strokeWidth":4,"opacity":1}
        ]
      }
    }
  ]
}

Rules:
- Only choose from the allowed font faces and look values.
- Coordinates are normalized within the SAFE area (0..1).
- Shapes should be subtle (accents, dividers, highlights). Do NOT cover main text.
- Prefer using the deck accent + secondary colors.
- IMPORTANT: introduce tasteful variety across slides:
  - Vary body fontSize slightly based on density/variant (within allowed ranges).
  - Occasionally use a different fontFace (Calibri vs Segoe UI) to avoid sameness.
  - Use color intentionally (kicker/underline/shape accents), but keep body text readable.
- If unsure, return an empty slides array.
`.trim();

  const payload = slides.map((s, i) => ({
    index: i,
    slideType: String(s?.slideType || "content"),
    title: String(s?.title || "").slice(0, 120),
    describe: String(s?.describe || "").slice(0, 240),
    bulletCount: Array.isArray(s?.content) ? s.content.length : 0,
    hasImage: !!s?.imageDataUri,
    variant: String(s?.layoutPlan?.variant || ""),
  }));

  const user = `Deck: ${deckTitle}
Deck describe: ${deckDescribe}
Deck look: ${deckLook}
Deck colors: ${JSON.stringify(outline?.colorScheme || {})}
Theme prompt (optional): ${themePrompt}
Decorate prompt (optional): ${decoratePrompt}

Slides:
${JSON.stringify(payload, null, 2)}
`;

  const sig = simpleHash(user);
  const cacheKey = `style:${deckTitle}:${sig}`;

  let json: any = null;
  try {
    json = await opts.anthropicJsonRequest(cacheKey, system, user, 900);
  } catch {
    // fall through to deterministic defaults
  }

  const applied = new Set<number>();

  const applyStyle = (idx: number, st: any) => {
    if (!Number.isFinite(idx) || idx < 0 || idx >= slides.length) return;
    const zones = exclusionZonesForSlide(slides[idx]);
    if (st.shapes) st.shapes = filterShapesAgainstZones(st.shapes, zones);
    slides[idx].stylePlan = st;
    if (st.look) slides[idx].look = st.look;
    applied.add(idx);
  };

  const arr = Array.isArray(json?.slides) ? json.slides : [];
  for (const entry of arr) {
    const idx = Number((entry as any)?.index);
    const st = sanitizeSlideStyle((entry as any)?.style);
    if (!st) continue;
    applyStyle(idx, st);
  }

  // Deterministic fallback styles: add subtle variety even if AI returns empty.
  const scheme = outline?.colorScheme || {};
  const accent = normHex((scheme as any)?.accent) || normHex((scheme as any)?.primary) || "#6ee7ff";
  const secondary = normHex((scheme as any)?.secondary) || "#a78bfa";

  const pick = (seed: string, options: string[]) => {
    const h = parseInt(simpleHash(seed).slice(0, 8), 16) >>> 0;
    return options[h % options.length];
  };

  const densityOf = (c: any[]): "light" | "medium" | "heavy" => {
    const bullets = Array.isArray(c) ? c.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const total = bullets.reduce((a, b) => a + b.length, 0);
    if (bullets.length >= 8 || total > 700) return "heavy";
    if (bullets.length >= 5 || total > 420) return "medium";
    return "light";
  };

  for (let i = 0; i < slides.length; i++) {
    if (applied.has(i)) continue;
    const s = slides[i] || {};
    const variant = String(s?.layoutPlan?.variant || "");
    const dens = densityOf(Array.isArray(s?.content) ? s.content : []);

    const fontFace = pick(`${deckTitle}|${variant}|${i}|font`, ["Calibri", "Segoe UI", "Arial"]) as any;
    const bodySize = dens === "heavy" ? 24 : dens === "medium" ? 26 : 28;
    const titleSize = dens === "heavy" ? 56 : dens === "medium" ? 62 : 68;

    const kickerColor = pick(`${deckTitle}|${variant}|${i}|kc`, [accent, secondary]);

    applyStyle(i, {
      title: { fontFace, fontSize: titleSize, color: "#ffffff", weight: "bold" },
      kicker: { fontFace, fontSize: 18, color: kickerColor, weight: "medium" },
      body: { fontFace, fontSize: bodySize, color: "#0b1220", weight: "regular" },
      shapes: [
        // A subtle top ribbon line that varies color.
        { kind: "rect", x: 0.06, y: 0.09, w: 0.22, h: 0.012, fill: kickerColor, opacity: 0.9 },
      ],
    });
  }

  return outline as Outline;
}
