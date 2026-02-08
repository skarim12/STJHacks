import { create } from 'zustand';
import { AIService } from '../services/AIService';
import { getPowerPointService } from '../services/PowerPointService';

type Status = 'idle' | 'generating' | 'error' | 'done';

type Store = {
  status: Status;
  error: string | null;
  ai: AIService;
  ppt: ReturnType<typeof getPowerPointService>;
  generateFromIdea: (idea: string) => Promise<void>;
};

export const useStore = create<Store>((set, get) => ({
  status: 'idle',
  error: null,
  ai: new AIService({ baseUrl: 'http://localhost:3000' }),
  ppt: getPowerPointService(),
  generateFromIdea: async (idea: string) => {
    set({ status: 'generating', error: null });
    try {
      const outline = await get().ai.generatePresentationOutline(idea);
      for (const slide of outline.slides) {
        await get().ppt.createSlideFromStructure(slide);
      }
      await get().ppt.applyColorTheme(outline.colorScheme);
      set({ status: 'done' });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  }
}));
