import type { DeckSchema, Slide } from '../types/deck.js';

export type SlideLayoutPlan = {
  version: '1.0';
  slideW: number;
  slideH: number;
  boxes: Array<{
    id: string;
    kind: 'title' | 'subtitle' | 'bullets' | 'body' | 'image' | 'shape';
    x: number;
    y: number;
    w: number;
    h: number;
    fontFace?: string;
    fontSize?: number;
    color?: string;
    fill?: string;
    line?: string;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    radius?: number;
  }>;
};

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

  const addTitle = (y: number, h: number, fontSize = 34) => {
    boxes.push({
      id: 'title',
      kind: 'title',
      x: marginX,
      y,
      w: SLIDE_W - marginX * 2,
      h,
      fontFace: heading,
      fontSize,
      bold: true,
      color: titleColor,
      align: 'left',
      valign: 'top'
    });
  };

  const addBullets = (x: number, y: number, w: number, h: number) => {
    boxes.push({
      id: 'bullets',
      kind: 'bullets',
      x,
      y,
      w,
      h,
      fontFace: body,
      fontSize: 18,
      color: bodyColor,
      align: 'left',
      valign: 'top'
    });
  };

  const addBody = (x: number, y: number, w: number, h: number) => {
    boxes.push({
      id: 'body',
      kind: 'body',
      x,
      y,
      w,
      h,
      fontFace: body,
      fontSize: 18,
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
    boxes.push({
      id: 'subtitle',
      kind: 'subtitle',
      x: marginX,
      y: 3.5,
      w: SLIDE_W - marginX * 2,
      h: 0.8,
      fontFace: body,
      fontSize: 20,
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
    addTitle(2.8, 1.1, 44);
    // subtle card behind title region
    addCard(marginX - 0.2, 2.6, SLIDE_W - (marginX - 0.2) * 2, 1.7);
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
