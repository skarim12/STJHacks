import { Router } from 'express';
import PptxGenJS from 'pptxgenjs';
import { DeckStore } from '../services/deckStore.js';
import type { DeckSchema, Slide } from '../types/deck.js';

export const exportRouter = Router();

function safeFileName(name: string): string {
  const base = (name || 'deck').replace(/[^a-z0-9-_]+/gi, '_');
  return base.slice(0, 80) || 'deck';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hslTripletToRgb(triplet: string): { r: number; g: number; b: number } {
  // input like "220 70% 50%"
  const parts = triplet.trim().split(/\s+/);
  const h = Number(parts[0] ?? 0);
  const s = Number(String(parts[1] ?? '0').replace('%', '')) / 100;
  const l = Number(String(parts[2] ?? '0').replace('%', '')) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));

  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hh >= 0 && hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (hh < 3) [r1, g1, b1] = [0, c, x];
  else if (hh < 4) [r1, g1, b1] = [0, x, c];
  else if (hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const m = l - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`.toUpperCase();
}

function hslTripletToHex(triplet: string): string {
  return rgbToHex(hslTripletToRgb(triplet));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t)
  };
}

function extractGradientTriplets(gradientCss: string): string[] {
  // find hsl(220 70% 50% / 0.2) or hsl(220 70% 50%) and return triplet part
  const triplets: string[] = [];
  const re = /hsl\(\s*([0-9.]+\s+[0-9.]+%\s+[0-9.]+%)(?:\s*\/\s*[0-9.]+)?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(gradientCss))) {
    triplets.push(m[1]);
  }
  return triplets;
}

function addBackground(s: any, deck: DeckSchema) {
  const W = 13.333;
  const H = 7.5;

  const bgTriplet = deck.theme?.backgroundColor || '0 0% 100%';
  const bgHex = hslTripletToHex(bgTriplet);

  // If we have a gradient, approximate it with bands (PptxGenJS doesn't do CSS gradients).
  const gradientCss = deck.decoration?.gradientCss;
  const triplets = gradientCss ? extractGradientTriplets(gradientCss) : [];

  if (triplets.length >= 2) {
    const a = hslTripletToRgb(triplets[0]);
    const b = hslTripletToRgb(triplets[triplets.length - 1]);

    const bands = 18;
    const bandH = H / bands;

    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const rgb = lerpRgb(a, b, t);
      const hex = rgbToHex(rgb);
      s.addShape('rect', {
        x: 0,
        y: i * bandH,
        w: W,
        h: bandH + 0.01,
        fill: { color: hex },
        line: { color: hex }
      });
    }
    return;
  }

  // Solid fallback
  s.addShape('rect', {
    x: 0,
    y: 0,
    w: W,
    h: H,
    fill: { color: bgHex },
    line: { color: bgHex }
  });
}

function addSlide(pptx: any, slide: Slide, deck: DeckSchema) {
  const s = pptx.addSlide();

  // Apply theme background (gradient approximation if provided)
  addBackground(s, deck);

  const titleColor = deck.theme?.accentColor ? hslTripletToHex(deck.theme.accentColor) : '111111';
  const bodyColor = deck.theme?.textColor ? hslTripletToHex(deck.theme.textColor) : '222222';

  // Optional "header stripe" decoration
  if (deck.decoration?.headerStripe && deck.theme?.primaryColor) {
    const stripeHex = hslTripletToHex(deck.theme.primaryColor);
    s.addShape('rect', {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.18,
      fill: { color: stripeHex },
      line: { color: stripeHex }
    });
  }

  const plan = (slide as any).layoutPlan as any | undefined;
  const photo = slide.selectedAssets?.find((a) => a.kind === 'photo' && a.dataUri)?.dataUri;
  const photoB64 = photo ? (photo.includes(',') ? photo.split(',')[1] : photo) : null;

  // Heuristic font auto-fit.
  const autoFitFont = (text: string, w: number, h: number, base: number) => {
    const area = Math.max(0.1, w * h);
    const density = text.length / area;
    const shrink = density > 180 ? 0.55 : density > 130 ? 0.7 : density > 95 ? 0.82 : 1;
    return clamp(Math.round(base * shrink), 10, 44);
  };

  if (plan?.boxes?.length) {
    for (const b of plan.boxes) {
      const kind = String(b.kind || 'body');
      const x = Number(b.x || 0);
      const y = Number(b.y || 0);
      const w = Number(b.w || 1);
      const h = Number(b.h || 1);

      if (kind === 'image') {
        if (photoB64) {
          s.addImage({ data: photoB64, x, y, w, h });
        }
        continue;
      }

      if (kind === 'shape') {
        const fill = String(b.fill || '').replace(/^#/, '').toUpperCase();
        const line = String(b.line || '').replace(/^#/, '').toUpperCase();
        const radius = Number(b.radius || 0);
        const shapeType = radius > 0.05 ? 'roundRect' : 'rect';
        s.addShape(shapeType, {
          x,
          y,
          w,
          h,
          fill: fill ? { color: fill, transparency: 15 } : undefined,
          line: line ? { color: line, transparency: 70 } : undefined,
          radius: radius || undefined
        });
        continue;
      }

      let text = '';
      if (kind === 'title') text = slide.title || '';
      else if (kind === 'subtitle') text = slide.subtitle || '';
      else if (kind === 'bullets') text = (slide.bullets ?? []).map((t) => `• ${t}`).join('\n');
      else if (kind === 'body') text = slide.bodyText || '';

      if (!text.trim()) continue;

      const baseSize = Number(b.fontSize || (kind === 'title' ? 34 : kind === 'subtitle' ? 18 : 16));
      const fontSize = autoFitFont(text, w, h, baseSize);

      const color = (String(b.color || '') || (kind === 'title' ? titleColor : bodyColor)).replace(/^#/, '').toUpperCase();

      s.addText(text, {
        x,
        y,
        w,
        h,
        fontFace: String(b.fontFace || (kind === 'title' ? deck.theme?.fontHeading : deck.theme?.fontBody) || 'Calibri'),
        fontSize,
        color,
        valign: String(b.valign || 'top'),
        align: String(b.align || 'left')
      });
    }
    return;
  }

  // Fallback deterministic layout
  const marginX = 0.5;
  const titleY = 0.35;
  const bodyY = 1.25;
  const hasPhoto = Boolean(photoB64);
  const titleW = 12.3;
  const bodyW = hasPhoto ? 6.3 : 12.3;

  s.addText(slide.title || '', {
    x: marginX,
    y: titleY,
    w: titleW,
    h: 0.6,
    fontFace: deck.theme?.fontHeading || 'Calibri',
    fontSize: 30,
    color: titleColor
  });

  const bodyLines = slide.bullets?.length ? slide.bullets.map((b) => `• ${b}`) : slide.bodyText ? [slide.bodyText] : [];
  if (bodyLines.length) {
    if (deck.decoration?.cardStyle === 'softShadow') {
      const cardHex = deck.theme?.secondaryColor ? hslTripletToHex(deck.theme.secondaryColor) : 'FFFFFF';
      s.addShape('roundRect', {
        x: marginX - 0.1,
        y: bodyY - 0.1,
        w: bodyW + 0.2,
        h: 5.9,
        fill: { color: cardHex, transparency: 15 },
        line: { color: cardHex, transparency: 100 },
        radius: 0.16
      });
    }
    s.addText(bodyLines.join('\n'), {
      x: marginX,
      y: bodyY,
      w: bodyW,
      h: 5.8,
      fontFace: deck.theme?.fontBody || 'Calibri',
      fontSize: 18,
      color: bodyColor,
      valign: 'top'
    });
  }

  if (photoB64) {
    s.addImage({ data: photoB64, x: 7.4, y: bodyY, w: 5.4, h: 4.05 });
  }
}

// Download a PPTX for a generated deck (web demo export)
// GET /api/export/pptx/:deckId
exportRouter.get('/pptx/:deckId', async (req, res) => {
  const deckId = String(req.params.deckId);
  const deck = DeckStore.get(deckId);
  if (!deck) return res.status(404).json({ success: false, error: 'Deck not found' });

  try {
    const pptx = new (PptxGenJS as any)();
    pptx.layout = 'LAYOUT_WIDE';

    // Basic metadata
    pptx.author = deck.metadata?.author || 'STJHacks';
    pptx.company = 'STJHacks';
    pptx.subject = deck.title;
    pptx.title = deck.title;

    for (const sl of deck.slides) addSlide(pptx, sl, deck);

    const buf: Buffer = await pptx.write('nodebuffer');

    const filename = `${safeFileName(deck.title)}.pptx`;
    res.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buf);
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message ?? String(e) });
  }
});
