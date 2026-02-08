import type { DeckSchema, Slide } from '../types/deck.js';

export type QaIssue = { level: 'info' | 'warn' | 'fail'; slideId?: string; message: string };
export type QaReport = { pass: boolean; score: number; issues: QaIssue[] };

const banned = ['key point', 'supporting detail', 'what we learned'];

function slideText(s: Slide): string {
  return [s.title, s.subtitle ?? '', ...(s.bullets ?? []), s.bodyText ?? '', s.speakerNotes ?? ''].join(' ').toLowerCase();
}

function estimateDensity(s: Slide): number {
  const plan: any = (s as any).layoutPlan;
  const txtLen = (s.title?.length ?? 0) + (s.subtitle?.length ?? 0) + (s.bodyText?.length ?? 0) + (s.bullets ?? []).join(' ').length;
  if (!plan?.boxes?.length) return txtLen / 40;
  const textBoxes = plan.boxes.filter((b: any) => ['title', 'subtitle', 'bullets', 'body'].includes(String(b.kind)));
  const area = textBoxes.reduce((a: number, b: any) => a + Math.max(0.1, Number(b.w || 0) * Number(b.h || 0)), 0);
  return txtLen / Math.max(0.1, area);
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

    const d = estimateDensity(s);
    if (d > 220) {
      issues.push({ level: 'fail', slideId: s.id, message: 'Slide is likely overcrowded (text density too high).' });
      score -= 15;
    } else if (d > 150) {
      issues.push({ level: 'warn', slideId: s.id, message: 'Slide may be dense; consider fewer bullets or smaller font.' });
      score -= 6;
    }

    if (s.slideType !== 'title' && (!s.speakerNotes || s.speakerNotes.trim().length < 20)) {
      issues.push({ level: 'warn', slideId: s.id, message: 'Missing or very short speaker notes.' });
      score -= 2;
    }
  }

  score = Math.max(0, Math.min(100, score));
  const pass = !issues.some((i) => i.level === 'fail') && score >= 70;
  return { pass, score, issues };
}
