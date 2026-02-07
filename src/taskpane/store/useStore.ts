import { create } from "zustand";
import { AIService } from "../services/AIService";
import { PowerPointService } from "../services/PowerPointService";
import { ResearchService } from "../services/ResearchService";
import { ThemeService } from "../services/ThemeService";
import type { PresentationOutline, SlideStructure, UserPreferences, ColorScheme } from "../types";

// Singletons
const aiService = new AIService();
const powerPointService = new PowerPointService();
const themeService = new ThemeService();
const researchService = new ResearchService(aiService);

interface AppState {
  aiService: AIService;
  powerPointService: PowerPointService;
  researchService: ResearchService;
  themeService: ThemeService;

  outline: PresentationOutline | null;
  slides: SlideStructure[];
  generating: boolean;
  error: string | null;
  selectedTheme: ColorScheme;

  setOutline: (outline: PresentationOutline | null) => void;
  setSlides: (slides: SlideStructure[]) => void;
  setError: (err: string | null) => void;
  setTheme: (theme: ColorScheme) => void;

  generateFromIdea: (idea: string, prefs?: UserPreferences) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  aiService,
  powerPointService,
  researchService,
  themeService,

  outline: null,
  slides: [],
  generating: false,
  error: null,
  selectedTheme: themeService.getDefaultScheme(),

  setOutline: (outline) => set({ outline }),
  setSlides: (slides) => set({ slides }),
  setError: (error) => set({ error }),
  setTheme: (theme) => set({ selectedTheme: theme }),

  generateFromIdea: async (idea: string, prefs?: UserPreferences) => {
    set({ generating: true, error: null });
    try {
      const outline = await get().aiService.generatePresentationOutline(idea, prefs);
      set({ outline, slides: outline.slides });
    } catch (err: any) {
      set({ error: err?.message || "Failed to generate outline" });
    } finally {
      set({ generating: false });
    }
  },
}));
