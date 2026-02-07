import type { Outline } from "./deckHtml";

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
- Prefer using the deck accent colors.
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

Slides:
${JSON.stringify(payload, null, 2)}
`;

  const sig = simpleHash(user);
  const cacheKey = `style:${deckTitle}:${sig}`;

  let json: any;
  try {
    json = await opts.anthropicJsonRequest(cacheKey, system, user, 900);
  } catch {
    return outline as Outline;
  }

  const arr = Array.isArray(json?.slides) ? json.slides : [];
  for (const entry of arr) {
    const idx = Number((entry as any)?.index);
    if (!Number.isFinite(idx) || idx < 0 || idx >= slides.length) continue;
    const st = sanitizeSlideStyle((entry as any)?.style);
    if (!st) continue;

    // Persist stylePlan on slide; keep deterministic renderer.
    slides[idx].stylePlan = st;

    // Allow stylePlan.look to override slide look.
    if (st.look) slides[idx].look = st.look;
  }

  return outline as Outline;
}
