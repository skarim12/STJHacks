import { create } from "zustand";
import { AIService } from "../services/AIService";
import { PowerPointService } from "../services/PowerPointService";
import { ResearchService } from "../services/ResearchService";
import { ThemeService } from "../services/ThemeService";
import { TemplateService } from "../services/TemplateService";
import { ContentService } from "../services/ContentService";
import type {
  PresentationOutline,
  SlideStructure,
  UserPreferences,
  ColorScheme,
  Template,
} from "../types";

// Singletons
const aiService = new AIService();
const powerPointService = new PowerPointService();
const researchService = new ResearchService(aiService);
const themeService = new ThemeService(aiService);
const templateService = new TemplateService(aiService);
const contentService = new ContentService(aiService);

interface AppState {
  // Services
  aiService: AIService;
  powerPointService: PowerPointService;
  researchService: ResearchService;
  themeService: ThemeService;
  templateService: TemplateService;
  contentService: ContentService;

  // Data
  outline: PresentationOutline | null;
  slides: SlideStructure[];
  generating: boolean;
  error: string | null;
  selectedTheme: ColorScheme;
  selectedTemplate: Template | null;

  // Setters
  setOutline: (outline: PresentationOutline | null) => void;
  setSlides: (slides: SlideStructure[]) => void;
  setError: (err: string | null) => void;
  setTheme: (theme: ColorScheme) => void;
  setSelectedTemplate: (tpl: Template | null) => void;

  // Flows
  generateFromIdea: (idea: string, prefs?: UserPreferences) => Promise<void>;
  editFromMessage: (message: string) => Promise<void>;
  exportPptx: () => Promise<void>;
  importPptx: (file: File) => Promise<void>;
  smartSelectTemplate: (topic: string) => Promise<void>;
  generateThemeForIndustry: (
    industry: string,
    mood: "professional" | "creative" | "energetic"
  ) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  aiService,
  powerPointService,
  researchService,
  themeService,
  templateService,
  contentService,

  outline: null,
  slides: [],
  generating: false,
  error: null,
  selectedTheme: themeService.getDefaultScheme(),
  selectedTemplate: null,

  setOutline: (outline) => set({ outline }),
  setSlides: (slides) => set({ slides }),
  setError: (error) => set({ error }),
  setTheme: (theme) => set({ selectedTheme: theme }),
  setSelectedTemplate: (tpl) => set({ selectedTemplate: tpl }),

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

  editFromMessage: async (message: string) => {
    const current = get().outline;
    if (!current) {
      set({ error: "Generate an outline first, then apply an edit message." });
      return;
    }

    set({ generating: true, error: null });
    try {
      const updated = await get().aiService.editOutline(current, message);
      set({ outline: updated, slides: updated.slides });
    } catch (err: any) {
      set({ error: err?.message || "Failed to edit outline" });
    } finally {
      set({ generating: false });
    }
  },

  exportPptx: async () => {
    const outline = get().outline;
    if (!outline) {
      set({ error: "Generate an outline first, then export." });
      return;
    }

    set({ generating: true, error: null });
    try {
      const blob = await get().aiService.exportPptx(outline);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(outline.title || "presentation").replace(/\s+/g, "_")}.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      set({ error: err?.message || "Failed to export PPTX" });
    } finally {
      set({ generating: false });
    }
  },

  importPptx: async (file: File) => {
    set({ generating: true, error: null });
    try {
      const { outline } = await get().aiService.importPptx(file);
      set({ outline, slides: outline.slides });
    } catch (err: any) {
      set({ error: err?.message || "Failed to import PPTX" });
    } finally {
      set({ generating: false });
    }
  },

  smartSelectTemplate: async (topic: string) => {
    try {
      const tpl = await get().templateService.suggestTemplate(topic);
      set({ selectedTemplate: tpl });
    } catch (err: any) {
      set({ error: err?.message || "Failed to suggest template" });
    }
  },

  generateThemeForIndustry: async (
    industry: string,
    mood: "professional" | "creative" | "energetic"
  ) => {
    try {
      const theme = await get().themeService.generateThemeFromContext(industry, mood);
      set({ selectedTheme: theme });
    } catch (err: any) {
      set({ error: err?.message || "Failed to generate theme" });
    }
  },
}));
