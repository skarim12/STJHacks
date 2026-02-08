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
    return await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load('count');
      await context.sync();
      return { title: 'Active Presentation', slideCount: slides.count };
    });
  }

  async createSlideFromStructure(structure: SlideStructure): Promise<void> {
    // NOTE: This requires Office.js runtime inside PowerPoint.
    await PowerPoint.run(async (context) => {
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
    // Minimal insertion (Phase 1): title + bullets/body. Other layouts come later.
    return await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      const created = slides.add();
      const shapes = created.shapes;

      const title = shapes.addTextBox(slide.title || '');
      title.left = 50;
      title.top = 30;
      title.width = 620;
      title.height = 50;

      const bodyLines =
        slide.bullets?.length ? slide.bullets.map((b) => `• ${b}`) : slide.bodyText ? [slide.bodyText] : [];
      if (bodyLines.length) {
        const body = shapes.addTextBox(bodyLines.join('\n'));
        body.left = 50;
        body.top = 110;
        body.width = 620;
        body.height = 360;
      }

      await context.sync();

      // We can't easily get the exact index of the created slide without more loads;
      // return best-effort.
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
