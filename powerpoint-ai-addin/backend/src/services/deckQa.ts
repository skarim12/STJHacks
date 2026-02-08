import type { DeckSchema, Slide } from '../types/deck.js';

export type QaIssue = { level: 'info' | 'warn' | 'fail'; slideId?: string; message: string };
export type QaReport = { pass: boolean; score: number; issues: QaIssue[] };

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

const banned = ['key point', 'supporting detail', 'what we learned'];

function slideText(s: Slide): string {
  return [s.title, s.subtitle ?? '', ...(s.bullets ?? []), s.bodyText ?? '', s.speakerNotes ?? ''].join(' ').toLowerCase();
}

function estimateDensity(s: Slide): number {
  const plan: any = (s as any).layoutPlan;
  const txtLen =
    (s.title?.length ?? 0) +
    (s.subtitle?.length ?? 0) +
    (s.bodyText?.length ?? 0) +
    (s.bullets ?? []).join(' ').length;
  if (!plan?.boxes?.length) return txtLen / 40;
  const textBoxes = plan.boxes.filter((b: any) => ['title', 'subtitle', 'bullets', 'body'].includes(String(b.kind)));
  const area = textBoxes.reduce((a: number, b: any) => a + Math.max(0.1, Number(b.w || 0) * Number(b.h || 0)), 0);
  return txtLen / Math.max(0.1, area);
}

function rectOfBox(b: any) {
  const x = Number(b.x || 0);
  const y = Number(b.y || 0);
  const w = Number(b.w || 0);
  const h = Number(b.h || 0);
  return { x, y, w, h, x2: x + w, y2: y + h };
}

function overlaps(a: any, b: any): boolean {
  return a.x < b.x2 && a.x2 > b.x && a.y < b.y2 && a.y2 > b.y;
}

export function runDeckQa(deck: DeckSchema): QaReport {
  const issues: QaIssue[] = [];
  let score = 100;

  const slides = deck.slides ?? [];
  if (slides.length < 3) {
    issues.push({ level: 'fail', message: 'Deck has fewer than 3 slides.' });
    score -= 30;
  }

  const bulletCounts = slides.map((s) => (s.bullets?.length ?? 0)).filter((n) => n > 0);
  if (bulletCounts.length) {
    const allSame = bulletCounts.every((n) => n === bulletCounts[0]);
    if (allSame) {
      issues.push({ level: 'warn', message: `All bullet slides have the same bullet count (${bulletCounts[0]}).` });
      score -= 8;
    }
  }

  for (const s of slides) {
    const t = slideText(s);
    if (banned.some((b) => t.includes(b))) {
      issues.push({ level: 'fail', slideId: s.id, message: 'Slide contains placeholder-style text.' });
      score -= 12;
    }

    // Layout QA
    const plan: any = (s as any).layoutPlan;
    if (!plan?.boxes?.length) {
      issues.push({ level: 'warn', slideId: s.id, message: 'Missing layoutPlan (preview/export may be inconsistent).' });
      score -= 3;
    } else {
      const slideW = Number(plan.slideW || SLIDE_W);
      const slideH = Number(plan.slideH || SLIDE_H);

      // Bounds
      for (const b of plan.boxes) {
        const r = rectOfBox(b);
        if (r.w <= 0 || r.h <= 0) {
          issues.push({ level: 'fail', slideId: s.id, message: 'layoutPlan has a zero-size box.' });
          score -= 10;
          break;
        }
        if (r.x < -0.01 || r.y < -0.01 || r.x2 > slideW + 0.01 || r.y2 > slideH + 0.01) {
          issues.push({ level: 'fail', slideId: s.id, message: 'layoutPlan has a box out of slide bounds.' });
          score -= 12;
          break;
        }
      }

      // Overlaps (ignore shapes, treat them as backgrounds)
      const contentBoxes = plan.boxes.filter((b: any) => {
        const k = String(b.kind || '');
        return k !== 'shape';
      });

      for (let i = 0; i < contentBoxes.length; i++) {
        for (let j = i + 1; j < contentBoxes.length; j++) {
          const a = rectOfBox(contentBoxes[i]);
          const b = rectOfBox(contentBoxes[j]);
          if (!overlaps(a, b)) continue;

          const ka = String(contentBoxes[i].kind || '');
          const kb = String(contentBoxes[j].kind || '');

          // Ignore small overlaps (tolerate 0.05in slop)
          const ox = Math.min(a.x2, b.x2) - Math.max(a.x, b.x);
          const oy = Math.min(a.y2, b.y2) - Math.max(a.y, b.y);
          if (ox < 0.05 || oy < 0.05) continue;

          issues.push({ level: 'fail', slideId: s.id, message: `layoutPlan boxes overlap (${ka} vs ${kb}).` });
          score -= 10;
          i = contentBoxes.length; // break outer
          break;
        }
      }

      // Fonts too small (exporter honors these)
      const tooSmall = plan.boxes.some((b: any) => {
        const k = String(b.kind || '');
        const fs = b.fontSize != null ? Number(b.fontSize) : null;
        if (fs == null) return false;
        if (k === 'title') return fs < 26;
        if (k === 'subtitle') return fs < 16;
        if (k === 'body' || k === 'bullets') return fs < 14;
        return false;
      });
      if (tooSmall) {
        issues.push({ level: 'warn', slideId: s.id, message: 'Some text boxes use small font sizes (<14pt body or <26pt title).' });
        score -= 4;
      }

      // Images: if an image box exists, ensure we have a photo asset
      const wantsImage = plan.boxes.some((b: any) => String(b.kind || '') === 'image');
      const hasPhoto = Boolean(s.selectedAssets?.some((a) => a.kind === 'photo' && a.dataUri));
      if (wantsImage && !hasPhoto) {
        issues.push({ level: 'warn', slideId: s.id, message: 'Slide has an image box but no resolved photo asset.' });
        score -= 3;
      }
    }

    // Content density
    const d = estimateDensity(s);
    if (d > 220) {
      issues.push({ level: 'fail', slideId: s.id, message: 'Slide is likely overcrowded (text density too high).' });
      score -= 15;
    } else if (d > 150) {
      issues.push({ level: 'warn', slideId: s.id, message: 'Slide may be dense; consider fewer bullets or smaller font.' });
      score -= 6;
    }

    // Speaker notes
    if (s.slideType !== 'title' && (!s.speakerNotes || s.speakerNotes.trim().length < 20)) {
      issues.push({ level: 'warn', slideId: s.id, message: 'Missing or very short speaker notes.' });
      score -= 2;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const pass = !issues.some((i) => i.level === 'fail') && score >= 70;
  return { pass, score, issues };
}
