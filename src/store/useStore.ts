import { create } from "zustand";
import { AIService } from "../services/AIService";
import { PowerPointService } from "../services/PowerPointService";
import { ResearchService } from "../services/ResearchService";
import type { PresentationOutline, SlideStructure, UserPreferences } from "../types";

// Singletons
const aiService = new AIService();
const powerPointService = new PowerPointService();
const researchService = new ResearchService(aiService);

interface AppState {
  aiService: AIService;
  powerPointService: PowerPointService;
  researchService: ResearchService;

  outline: PresentationOutline | null;
  slides: SlideStructure[];
  generating: boolean;

  setOutline: (outline: PresentationOutline | null) => void;
  setSlides: (slides: SlideStructure[]) => void;

  generateFromIdea: (idea: string, prefs?: UserPreferences) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  aiService,
  powerPointService,
  researchService,

  outline: null,
  slides: [],
  generating: false,

  setOutline: (outline) => set({ outline }),
  setSlides: (slides) => set({ slides }),

  generateFromIdea: async (idea: string, prefs?: UserPreferences) => {
    set({ generating: true });
    try {
      const outline = await get().aiService.generatePresentationOutline(idea, prefs);
      set({ outline, slides: outline.slides });
    } finally {
      set({ generating: false });
    }
  }
}));
