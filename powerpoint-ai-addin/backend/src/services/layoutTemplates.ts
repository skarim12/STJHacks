import type { DeckSchema, Slide, SlideLayoutPlan } from '../types/deck.js';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

/**
 * Deterministic, template-first fallback layout plans.
 * These are intentionally conservative: readable typography, safe margins, low overlap risk.
 */
export function buildFallbackLayoutPlan(opts: { deck: DeckSchema; slide: Slide }): SlideLayoutPlan {
  const { deck, slide } = opts;
  const hasPhoto = Boolean(slide.selectedAssets?.some((a) => a.kind === 'photo' && a.dataUri));

  const heading = deck.theme?.fontHeading || 'Segoe UI';
  const body = deck.theme?.fontBody || 'Segoe UI';

  // Colors: export.ts expects hex without #, but layoutPlan is used by multiple consumers.
  // Keep fills/colors as #RRGGBB for preview; exporter strips # already.
  const titleColor = '#111111';
  const bodyColor = '#222222';
  const cardFill = 'rgba(0,0,0,0.04)';

  const marginX = 0.7;
  const marginY = 0.5;
  const gap = 0.35;

  const boxes: SlideLayoutPlan['boxes'] = [];

  const autoFont = (text: string, w: number, h: number, base: number, min: number) => {
    const area = Math.max(0.1, w * h);
    const density = (text?.length ?? 0) / area;
    const shrink = density > 220 ? 0.6 : density > 160 ? 0.72 : density > 120 ? 0.85 : 1;
    return Math.max(min, Math.round(base * shrink));
  };

  const addTitle = (y: number, h: number, fontSize = 34) => {
    const txt = slide.title || '';
    const fs = autoFont(txt, SLIDE_W - marginX * 2, h, fontSize, 28);
    boxes.push({
      id: 'title',
      kind: 'title',
      x: marginX,
      y,
      w: SLIDE_W - marginX * 2,
      h,
      fontFace: heading,
      fontSize: fs,
      bold: true,
      color: titleColor,
      align: 'left',
      valign: 'top'
    });
  };

  const addBullets = (x: number, y: number, w: number, h: number) => {
    const txt = (slide.bullets ?? []).map((t) => `• ${t}`).join('\n');
    const fs = autoFont(txt, w, h, 18, 14);
    boxes.push({
      id: 'bullets',
      kind: 'bullets',
      x,
      y,
      w,
      h,
      fontFace: body,
      fontSize: fs,
      color: bodyColor,
      align: 'left',
      valign: 'top'
    });
  };

  const addBody = (x: number, y: number, w: number, h: number) => {
    const txt = slide.bodyText || '';
    const fs = autoFont(txt, w, h, 18, 14);
    boxes.push({
      id: 'body',
      kind: 'body',
      x,
      y,
      w,
      h,
      fontFace: body,
      fontSize: fs,
      color: bodyColor,
      align: 'left',
      valign: 'top'
    });
  };

  const addImage = (x: number, y: number, w: number, h: number) => {
    boxes.push({ id: 'image', kind: 'image', x, y, w, h });
  };

  const addCard = (x: number, y: number, w: number, h: number) => {
    boxes.push({
      id: `card-${Math.round(x * 100)}-${Math.round(y * 100)}`,
      kind: 'shape',
      x,
      y,
      w,
      h,
      fill: cardFill,
      line: 'rgba(0,0,0,0.06)',
      radius: 0.18
    });
  };

  // Templates by slideType
  if (slide.slideType === 'title') {
    // Big title + optional subtitle + hero image (if exists)
    addTitle(2.2, 1.2, 44);
    const subtitleTxt = slide.subtitle || '';
    boxes.push({
      id: 'subtitle',
      kind: 'subtitle',
      x: marginX,
      y: 3.5,
      w: SLIDE_W - marginX * 2,
      h: 0.85,
      fontFace: body,
      fontSize: autoFont(subtitleTxt, SLIDE_W - marginX * 2, 0.85, 20, 16),
      color: bodyColor,
      align: 'left',
      valign: 'top'
    });

    if (hasPhoto) {
      addImage(SLIDE_W - marginX - 4.6, 0.9, 4.6, 5.6);
    }

    return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
  }

  if (slide.slideType === 'section') {
    // subtle card behind title region
    addCard(marginX - 0.2, 2.6, SLIDE_W - (marginX - 0.2) * 2, 1.7);
    addTitle(2.8, 1.1, 44);
    return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
  }

  if (slide.slideType === 'quote') {
    addTitle(marginY, 0.8, 32);

    const qText = slide.quote?.text || slide.bodyText || (slide.bullets ?? []).join(' ') || '';
    const qBoxX = marginX;
    const qBoxY = 1.6;
    const qBoxW = SLIDE_W - marginX * 2;
    const qBoxH = 4.2;

    addCard(qBoxX - 0.2, qBoxY - 0.2, qBoxW + 0.4, qBoxH + 0.4);
    boxes.push({
      id: 'body',
      kind: 'body',
      x: qBoxX,
      y: qBoxY,
      w: qBoxW,
      h: qBoxH,
      fontFace: body,
      fontSize: autoFont(qText, qBoxW, qBoxH, 26, 18),
      color: bodyColor,
      align: 'left',
      valign: 'top'
    });

    const attribution = slide.quote?.attribution || '';
    if (attribution) {
      boxes.push({
        id: 'subtitle',
        kind: 'subtitle',
        x: qBoxX,
        y: qBoxY + qBoxH + 0.35,
        w: qBoxW,
        h: 0.6,
        fontFace: body,
        fontSize: 16,
        color: bodyColor,
        align: 'right',
        valign: 'top'
      });
    }

    return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
  }

  if (slide.slideType === 'twoColumn' || slide.slideType === 'comparison') {
    const titleH = 0.8;
    addTitle(marginY, titleH, 32);

    const bodyTop = marginY + titleH + 0.35;
    const bodyH = SLIDE_H - bodyTop - marginY;

    const colW = (SLIDE_W - marginX * 2 - gap) / 2;
    const leftX = marginX;
    const rightX = marginX + colW + gap;

    addCard(leftX - 0.15, bodyTop - 0.1, colW + 0.3, bodyH + 0.2);
    addCard(rightX - 0.15, bodyTop - 0.1, colW + 0.3, bodyH + 0.2);

    // Use bullets kind for both columns; (note) current renderers use Slide.bullets/bodyText.
    // This layout is still useful for PPTX export, and we can later map left/right columns.
    boxes.push({ id: 'left', kind: 'bullets', x: leftX, y: bodyTop, w: colW, h: bodyH, fontFace: body, fontSize: 16, color: bodyColor });
    boxes.push({ id: 'right', kind: 'bullets', x: rightX, y: bodyTop, w: colW, h: bodyH, fontFace: body, fontSize: 16, color: bodyColor });

    return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
  }

  // Agenda / Summary: short bullet list with larger font.
  if (/\b(agenda|overview|outline|today)\b/i.test(slide.title || '')) {
    const titleH = 0.85;
    addTitle(marginY, titleH, 36);
    const bodyTop = marginY + titleH + 0.45;
    const bodyH = SLIDE_H - bodyTop - marginY;
    addCard(marginX - 0.2, bodyTop - 0.15, SLIDE_W - (marginX - 0.2) * 2, bodyH + 0.3);
    boxes.push({ id: 'bullets', kind: 'bullets', x: marginX, y: bodyTop, w: SLIDE_W - marginX * 2, h: bodyH, fontFace: body, fontSize: 22, color: bodyColor });
    return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
  }

  if (/\b(summary|recap|takeaways|next steps)\b/i.test(slide.title || '')) {
    const titleH = 0.85;
    addTitle(marginY, titleH, 36);
    const bodyTop = marginY + titleH + 0.45;
    const bodyH = SLIDE_H - bodyTop - marginY;
    addCard(marginX - 0.2, bodyTop - 0.15, SLIDE_W - (marginX - 0.2) * 2, bodyH + 0.3);
    boxes.push({ id: 'bullets', kind: 'bullets', x: marginX, y: bodyTop, w: SLIDE_W - marginX * 2, h: bodyH, fontFace: body, fontSize: 20, color: bodyColor });
    return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
  }

  // Timeline / Process: bullets on left + image/diagram space on right
  if (slide.visualIntent?.visualType === 'timeline' || /\b(timeline|milestones|roadmap|phases|steps|process)\b/i.test(slide.title || '')) {
    const titleH = 0.85;
    addTitle(marginY, titleH, 34);

    const bodyTop = marginY + titleH + 0.35;
    const bodyH = SLIDE_H - bodyTop - marginY;

    const leftW = 6.4;
    const rightW = SLIDE_W - marginX * 2 - leftW - gap;

    const leftX = marginX;
    const rightX = marginX + leftW + gap;

    addCard(leftX - 0.15, bodyTop - 0.1, leftW + 0.3, bodyH + 0.2);
    addCard(rightX - 0.15, bodyTop - 0.1, rightW + 0.3, bodyH + 0.2);

    boxes.push({ id: 'bullets', kind: 'bullets', x: leftX, y: bodyTop, w: leftW, h: bodyH, fontFace: body, fontSize: 18, color: bodyColor });
    // Reserve visual space: if we have a photo, use it; otherwise leave as shape box.
    if (hasPhoto) addImage(rightX, bodyTop, rightW, bodyH);
    else boxes.push({ id: 'shape-timeline', kind: 'shape', x: rightX, y: bodyTop, w: rightW, h: bodyH, fill: 'rgba(0,0,0,0.03)', line: 'rgba(0,0,0,0.06)', radius: 0.18 });

    return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
  }

  // Default content layouts
  const titleH = 0.85;
  addTitle(marginY, titleH, 34);

  const bodyTop = marginY + titleH + 0.35;
  const bodyH = SLIDE_H - bodyTop - marginY;

  // If slide wants image and we have one, use split layout; else full text.
  const wantsImage = slide.imagePlaceholders?.some((p) => p.suggestedType === 'photo') || slide.visualIntent?.visualType === 'photo';

  if (hasPhoto && wantsImage) {
    const imgW = 5.0;
    const imgH = bodyH;
    const imgX = SLIDE_W - marginX - imgW;
    const imgY = bodyTop;

    const textX = marginX;
    const textY = bodyTop;
    const textW = SLIDE_W - marginX * 2 - imgW - gap;
    const textH = bodyH;

    // soft card behind text
    addCard(textX - 0.15, textY - 0.1, textW + 0.3, textH + 0.2);

    if (Array.isArray(slide.bullets) && slide.bullets.length) addBullets(textX, textY, textW, textH);
    else addBody(textX, textY, textW, textH);

    addImage(imgX, imgY, imgW, imgH);
  } else {
    const textX = marginX;
    const textY = bodyTop;
    const textW = SLIDE_W - marginX * 2;
    const textH = bodyH;

    addCard(textX - 0.15, textY - 0.1, textW + 0.3, textH + 0.2);

    if (Array.isArray(slide.bullets) && slide.bullets.length) addBullets(textX, textY, textW, textH);
    else addBody(textX, textY, textW, textH);
  }

  return { version: '1.0', slideW: SLIDE_W, slideH: SLIDE_H, boxes };
}
