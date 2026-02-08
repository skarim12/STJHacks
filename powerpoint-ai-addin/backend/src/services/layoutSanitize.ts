import type { SlideLayoutPlan } from '../types/deck.js';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Deterministically sanitize a layout plan:
 * - clamp into slide bounds
 * - enforce minimum sizes
 * - normalize fontSize range
 * This is a safety net for preview/export/insertion.
 */
export function sanitizeLayoutPlan(plan: SlideLayoutPlan): SlideLayoutPlan {
  const slideW = Number(plan.slideW || SLIDE_W);
  const slideH = Number(plan.slideH || SLIDE_H);

  const boxes = (plan.boxes ?? []).map((b) => {
    const x0 = Number(b.x || 0);
    const y0 = Number(b.y || 0);
    const w0 = Number(b.w || 0);
    const h0 = Number(b.h || 0);

    const x = clamp(x0, 0, slideW - 0.1);
    const y = clamp(y0, 0, slideH - 0.1);
    const w = clamp(w0 || 0.1, 0.1, slideW - x);
    const h = clamp(h0 || 0.1, 0.1, slideH - y);

    const fs = b.fontSize != null ? clamp(Number(b.fontSize), 10, 54) : undefined;

    return {
      ...b,
      x,
      y,
      w,
      h,
      fontSize: fs
    };
  });

  return {
    ...plan,
    version: '1.0',
    slideW,
    slideH,
    boxes
  };
}
