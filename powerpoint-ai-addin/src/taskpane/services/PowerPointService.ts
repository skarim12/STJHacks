import type { ColorScheme, DeckSchema, Slide, SlideStructure, ThemeTokens } from '../types';

export interface IPowerPointService {
  isReady(): Promise<boolean>;
  getActivePresentation(): Promise<{ title: string; slideCount: number }>;
  createSlideFromStructure(structure: SlideStructure): Promise<void>;
  insertSlide(slide: Slide): Promise<{ success: boolean; slideIndex: number }>;
  insertDeck(deck: DeckSchema): Promise<{ success: boolean; slideCount: number }>;
  applyTheme(theme: ThemeTokens): Promise<boolean>;
  applyColorTheme(theme: ColorScheme): Promise<void>; // legacy
}

const isOfficeContext = (): boolean => {
  return typeof window !== 'undefined' && (window as any).Office?.onReady != null;
};

class MockPowerPointService implements IPowerPointService {
  private inserted: Slide[] = [];

  async isReady(): Promise<boolean> {
    console.log('[MockPPT] ready');
    return true;
  }

  async getActivePresentation(): Promise<{ title: string; slideCount: number }> {
    return { title: 'Mock Presentation', slideCount: this.inserted.length };
  }

  async createSlideFromStructure(structure: SlideStructure): Promise<void> {
    // Basic compatibility: map SlideStructure -> Slide
    await this.insertSlide({
      id: `mock-${Date.now()}`,
      order: this.inserted.length,
      slideType: 'bullets',
      layout: 'full',
      title: structure.title,
      bullets: structure.content,
      speakerNotes: structure.notes
    } as any);
  }

  async insertSlide(slide: Slide): Promise<{ success: boolean; slideIndex: number }> {
    console.log('[MockPPT] inserting slide', slide.title);
    this.inserted.push(slide);
    return { success: true, slideIndex: this.inserted.length - 1 };
  }

  async insertDeck(deck: DeckSchema): Promise<{ success: boolean; slideCount: number }> {
    console.log('[MockPPT] inserting deck', deck.title);
    for (const s of deck.slides) await this.insertSlide(s);
    return { success: true, slideCount: deck.slides.length };
  }

  async applyTheme(theme: ThemeTokens): Promise<boolean> {
    console.log('[MockPPT] applyTheme', theme);
    return true;
  }

  async applyColorTheme(_theme: ColorScheme): Promise<void> {
    return;
  }
}

class OfficePowerPointService implements IPowerPointService {
  async isReady(): Promise<boolean> {
    if (!isOfficeContext()) return false;
    return await new Promise((resolve) => {
      (window as any).Office.onReady((info: any) => {
        resolve(info?.host === 'PowerPoint');
      });
    });
  }

  async getActivePresentation(): Promise<{ title: string; slideCount: number }> {
    // Office.js does not reliably expose presentation title; keep it simple.
    // In web preview builds, PowerPoint global won't exist.
    const PP = (globalThis as any).PowerPoint;
    if (!PP?.run) return { title: 'Active Presentation', slideCount: 0 };

    return await PP.run(async (context: any) => {
      const slides = context.presentation.slides;
      slides.load('count');
      await context.sync();
      return { title: 'Active Presentation', slideCount: slides.count };
    });
  }

  async createSlideFromStructure(structure: SlideStructure): Promise<void> {
    // NOTE: This requires Office.js runtime inside PowerPoint.
    const PP = (globalThis as any).PowerPoint;
    if (!PP?.run) throw new Error('PowerPoint global is not available (not running inside Office).');

    await PP.run(async (context: any) => {
      const slide = context.presentation.slides.add();
      const shapes = slide.shapes;

      const title = shapes.addTextBox(structure.title);
      title.left = 50;
      title.top = 30;
      title.width = 620;
      title.height = 50;

      if (structure.slideType === 'content' && structure.content?.length) {
        const body = shapes.addTextBox(structure.content.map((p) => `• ${p}`).join('\n'));
        body.left = 50;
        body.top = 110;
        body.width = 620;
        body.height = 360;
      }

      await context.sync();
    });
  }

  async insertSlide(slide: Slide): Promise<{ success: boolean; slideIndex: number }> {
    // Insertion using optional AI-generated raw layoutPlan.
    // If layoutPlan is missing, fall back to a simple deterministic layout.
    const PP = (globalThis as any).PowerPoint;
    if (!PP?.run) throw new Error('PowerPoint global is not available (not running inside Office).');

    const plan = (slide as any).layoutPlan as any | undefined;

    // Helpers: PPT points -> Office.js uses points.
    // PptxGen uses inches; Office.js positions are in points.
    const INCH_TO_PT = 72;
    const toPt = (v: number) => Math.round(v * INCH_TO_PT);

    // Very simple auto-fit: reduce font size if text is likely too long for the box.
    const autoFitFont = (text: string, boxWIn: number, boxHIn: number, base: number) => {
      const w = Math.max(0.1, boxWIn);
      const h = Math.max(0.1, boxHIn);
      const area = w * h;
      const len = text.length;
      // heuristic: more characters => smaller font
      const density = len / Math.max(0.1, area);
      const shrink = density > 180 ? 0.55 : density > 130 ? 0.7 : density > 95 ? 0.82 : 1;
      return Math.max(10, Math.min(44, Math.round(base * shrink)));
    };

    return await PP.run(async (context: any) => {
      const slides = context.presentation.slides;
      const created = slides.add();
      const shapes = created.shapes;

      const photoDataUri = slide.selectedAssets?.find((a) => a.kind === 'photo' && a.dataUri)?.dataUri;
      const photoBase64 = photoDataUri ? (photoDataUri.includes(',') ? photoDataUri.split(',')[1] : photoDataUri) : null;

      const addImageBestEffort = (left: number, top: number, width: number, height: number) => {
        if (!photoDataUri && !photoBase64) return;
        try {
          // Most PowerPoint APIs expect raw base64 (no data: prefix)
          if (photoBase64) {
            const img = shapes.addImage(photoBase64);
            img.left = left;
            img.top = top;
            img.width = width;
            img.height = height;
            return;
          }
        } catch (e) {
          // fall through
        }

        try {
          // Some builds accept full data URIs.
          if (photoDataUri) {
            const img = shapes.addImage(photoDataUri);
            img.left = left;
            img.top = top;
            img.width = width;
            img.height = height;
          }
        } catch (e) {
          // If both fail, we silently skip (but leave room for QA/warnings upstream).
          console.warn('[PPT] addImage failed', e);
        }
      };

      if (plan?.boxes?.length) {
        for (const b of plan.boxes) {
          const kind = String(b.kind || 'body');
          const x = toPt(Number(b.x || 0));
          const y = toPt(Number(b.y || 0));
          const w = toPt(Number(b.w || 1));
          const h = toPt(Number(b.h || 1));

          if (kind === 'image') {
            addImageBestEffort(x, y, w, h);
            continue;
          }

          // Text content selection
          let text = '';
          if (kind === 'title') text = slide.title || '';
          else if (kind === 'subtitle') text = slide.subtitle || '';
          else if (kind === 'bullets') {
            const lines = slide.bullets?.length ? slide.bullets.map((t) => `• ${t}`) : [];
            text = lines.join('\n');
          } else if (kind === 'body') {
            text = slide.bodyText || '';
          } else {
            // shape/unknown -> ignore for now (Office.js shape styling is limited here)
            continue;
          }

          if (!text.trim()) continue;

          const tb = shapes.addTextBox(text);
          tb.left = x;
          tb.top = y;
          tb.width = w;
          tb.height = h;

          // Basic styling
          const baseSize = Number(b.fontSize || (kind === 'title' ? 34 : kind === 'subtitle' ? 18 : 16));
          const fitted = autoFitFont(text, Number(b.w || 1), Number(b.h || 1), baseSize);
          // PowerPoint JS API for font size is not always available on the TextBox object directly.
          // Leave as-is for now; we still place boxes correctly.
          // TODO: apply font size via textRange when Office.js supports it consistently.
          void fitted;
        }
      } else {
        // Fallback deterministic layout
        addImageBestEffort(380, 110, 290, 290);
        const title = shapes.addTextBox(slide.title || '');
        title.left = 50;
        title.top = 30;
        title.width = 620;
        title.height = 50;

        const bodyLines = slide.bullets?.length ? slide.bullets.map((t) => `• ${t}`) : slide.bodyText ? [slide.bodyText] : [];
        if (bodyLines.length) {
          const body = shapes.addTextBox(bodyLines.join('\n'));
          body.left = 50;
          body.top = 110;
          body.width = photoBase64 ? 300 : 620;
          body.height = 360;
        }
      }

      await context.sync();
      slides.load('count');
      await context.sync();
      return { success: true, slideIndex: Math.max(0, slides.count - 1) };
    });
  }

  async insertDeck(deck: DeckSchema): Promise<{ success: boolean; slideCount: number }> {
    // Insert sequentially to keep it simple & predictable.
    for (const s of deck.slides) {
      await this.insertSlide(s);
    }
    return { success: true, slideCount: deck.slides.length };
  }

  async applyTheme(_theme: ThemeTokens): Promise<boolean> {
    // TODO (Phase 2): map ThemeTokens -> PowerPoint theme/fonts.
    throw new Error('OfficePowerPointService.applyTheme not implemented yet.');
  }

  async applyColorTheme(_theme: ColorScheme): Promise<void> {
    // TODO: Apply theme across slides (requires design decisions + Office.js testing)
    return;
  }
}

export const getPowerPointService = (): IPowerPointService =>
  isOfficeContext() ? new OfficePowerPointService() : new MockPowerPointService();
