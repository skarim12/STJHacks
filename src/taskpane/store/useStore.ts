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
  importedFileName: string | null;
  extractedText: string | null;
  generating: boolean;
  error: string | null;
  selectedTheme: ColorScheme;
  selectedTemplate: Template | null;
  externalImagesEnabled: boolean;
  generatedImagesEnabled: boolean;

  // Diagnostics from last finalize/deck render
  lastEnrichment: any | null;

  // Optional deck-wide description hint (used for images/layout)
  deckDescribe: string;

  // Deck-wide look preset
  deckLook: "default" | "light" | "dark" | "bold";

  // Setters
  setOutline: (outline: PresentationOutline | null) => void;
  setSlides: (slides: SlideStructure[]) => void;
  setImported: (fileName: string | null, extractedText: string | null) => void;
  setError: (err: string | null) => void;
  setTheme: (theme: ColorScheme) => void;
  setSelectedTemplate: (tpl: Template | null) => void;
  setExternalImagesEnabled: (enabled: boolean) => void;
  setGeneratedImagesEnabled: (enabled: boolean) => void;
  setLastEnrichment: (enrichment: any | null) => void;
  setDeckDescribe: (describe: string) => void;
  setSlideDescribe: (index: number, describe: string) => void;
  setDeckLook: (look: "default" | "light" | "dark" | "bold") => void;
  setSlideLook: (index: number, look: "default" | "light" | "dark" | "bold") => void;

  // Flows
  applyThemePrompt: (themePrompt: string) => Promise<void>;
  decorateDeck: (decoratePrompt: string) => Promise<void>;
  generateFromIdea: (idea: string, prefs?: UserPreferences) => Promise<void>;
  editFromMessage: (message: string) => Promise<void>;
  editSlide: (slideIndex: number, message: string) => Promise<void>;
  getSlideHtml: (slideIndex: number) => Promise<string>;
  exportPptx: () => Promise<void>;
  exportPdf: () => Promise<void>;
  downloadOutlineJson: () => void;
  downloadExtractedText: () => void;
  importPptx: (file: File) => Promise<void>;
  smartSelectTemplate: (topic: string) => Promise<void>;
  generateThemeForIndustry: (
    industry: string,
    mood: "professional" | "creative" | "energetic"
  ) => Promise<void>;
  generateThemeFromDescribe: (describe: string) => Promise<void>;
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
  importedFileName: null,
  extractedText: null,
  generating: false,
  error: null,
  selectedTheme: themeService.getDefaultScheme(),
  selectedTemplate: null,
  externalImagesEnabled: false,
  generatedImagesEnabled: false,
  lastEnrichment: null,
  deckDescribe: "",
  deckLook: "default",

  setOutline: (outline) => set({ outline }),
  setSlides: (slides) => set({ slides }),
  setImported: (fileName, extractedText) => set({ importedFileName: fileName, extractedText }),
  setError: (error) => set({ error }),
  setTheme: (theme) => set({ selectedTheme: theme }),
  setSelectedTemplate: (tpl) => set({ selectedTemplate: tpl }),
  setExternalImagesEnabled: (enabled) =>
    set((s) => ({
      externalImagesEnabled: enabled,
      // If the user enables external images, default to generating a fallback image
      // when search misses (explicit user request; keeps decks visually complete).
      generatedImagesEnabled: enabled ? true : s.generatedImagesEnabled,
    })),
  setGeneratedImagesEnabled: (enabled) => set({ generatedImagesEnabled: enabled }),
  setLastEnrichment: (enrichment) => set({ lastEnrichment: enrichment }),
  setDeckDescribe: (describe) => {
    set({ deckDescribe: describe });
    const current = get().outline;
    if (current) {
      set({ outline: { ...current, describe }, slides: current.slides });
    }
  },
  setSlideDescribe: (index, describe) => {
    const current = get().outline;
    if (!current) return;
    const slides = current.slides.map((s, i) => (i === index ? { ...s, describe } : s));
    set({ outline: { ...current, slides }, slides });
  },
  setDeckLook: (look) => {
    set({ deckLook: look });
    const current = get().outline;
    if (current) set({ outline: { ...current, look }, slides: current.slides });
  },
  setSlideLook: (index, look) => {
    const current = get().outline;
    if (!current) return;
    const slides = current.slides.map((s, i) => (i === index ? { ...s, look } : s));
    set({ outline: { ...current, slides }, slides });
  },

  applyThemePrompt: async (themePrompt: string) => {
    const current = get().outline;
    if (!current) {
      set({ error: "Generate an outline first, then apply a theme prompt." });
      return;
    }
    set({ generating: true, error: null });
    try {
      const resp = await get().aiService.themeFromPrompt(current, themePrompt);
      const next = resp?.outline || current;
      set({ outline: next, slides: next.slides });
    } catch (err: any) {
      set({ error: err?.message || "Failed to apply theme" });
    } finally {
      set({ generating: false });
    }
  },

  decorateDeck: async (decoratePrompt: string) => {
    const current = get().outline;
    if (!current) {
      set({ error: "Generate an outline first, then decorate the deck." });
      return;
    }
    set({ generating: true, error: null, lastEnrichment: null });
    try {
      const resp = await get().aiService.decorateOutline(
        current,
        decoratePrompt,
        get().externalImagesEnabled,
        get().generatedImagesEnabled,
        "photo"
      );
      const next = resp?.outline || current;
      set({ outline: next, slides: next.slides, lastEnrichment: resp?.enrichment || null });
    } catch (err: any) {
      set({ error: err?.message || "Failed to decorate deck" });
    } finally {
      set({ generating: false });
    }
  },

  generateFromIdea: async (idea: string, prefs?: UserPreferences) => {
    set({ generating: true, error: null, lastEnrichment: null });
    try {
      const outline = await get().aiService.generatePresentationOutline(idea, prefs);
      const deckDescribe = get().deckDescribe?.trim();
      const withDescribe = deckDescribe ? { ...outline, describe: deckDescribe } : outline;

      // Immediately "finish" the deck after generation so previews/edits operate on the
      // same finalized layout+style+image-enriched outline.
      const finalized = await get().aiService.finalizeOutline(
        withDescribe,
        true,
        get().externalImagesEnabled,
        get().generatedImagesEnabled,
        "photo"
      );

      const next = finalized?.outline || withDescribe;
      set({ outline: next, slides: next.slides, lastEnrichment: finalized?.enrichment || null });
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

  editSlide: async (slideIndex: number, message: string) => {
    const current = get().outline;
    if (!current) {
      set({ error: "Generate an outline first, then edit a slide." });
      return;
    }
    set({ generating: true, error: null });
    try {
      const updated = await get().aiService.editSlide(current, slideIndex, message);
      set({ outline: updated, slides: updated.slides });
    } catch (err: any) {
      set({ error: err?.message || "Failed to edit slide" });
    } finally {
      set({ generating: false });
    }
  },

  getSlideHtml: async (slideIndex: number) => {
    const outline = get().outline;
    if (!outline) throw new Error("No outline available");
    return await get().aiService.getSlideHtml(
      outline,
      slideIndex,
      true,
      get().externalImagesEnabled,
      get().generatedImagesEnabled,
      "photo"
    );
  },

  exportPptx: async () => {
    const outline = get().outline;
    if (!outline) {
      set({ error: "Generate an outline first, then export." });
      return;
    }

    set({ generating: true, error: null });
    try {
      const blob = await get().aiService.exportPptx(
        outline,
        get().externalImagesEnabled,
        get().generatedImagesEnabled,
        "photo"
      );
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

  exportPdf: async () => {
    const outline = get().outline;
    if (!outline) {
      set({ error: "Generate an outline first, then export." });
      return;
    }

    set({ generating: true, error: null });
    try {
      const blob = await get().aiService.exportPdf(
        outline,
        true,
        get().externalImagesEnabled,
        get().generatedImagesEnabled
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(outline.title || "deck").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      set({ error: err?.message || "Failed to export PDF" });
    } finally {
      set({ generating: false });
    }
  },

  downloadOutlineJson: () => {
    const outline = get().outline;
    if (!outline) {
      set({ error: "No outline to download yet." });
      return;
    }

    const blob = new Blob([JSON.stringify(outline, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(outline.title || "outline").replace(/\s+/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadExtractedText: () => {
    const text = get().extractedText;
    const name = get().importedFileName || "deck";
    if (!text) {
      set({ error: "No extracted text available (upload/import a PPTX first)." });
      return;
    }

    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "_")}_extracted.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  importPptx: async (file: File) => {
    set({ generating: true, error: null });
    try {
      const { outline, extractedText } = await get().aiService.importPptx(file);
      const deckDescribe = get().deckDescribe?.trim();
      const withDescribe = deckDescribe ? { ...outline, describe: deckDescribe } : outline;
      set({ outline: withDescribe, slides: withDescribe.slides, importedFileName: file.name, extractedText });
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
      const current = get().outline;
      if (current) set({ outline: { ...current, colorScheme: theme }, slides: current.slides });
    } catch (err: any) {
      set({ error: err?.message || "Failed to generate theme" });
    }
  },

  generateThemeFromDescribe: async (describe: string) => {
    try {
      const { colorScheme, themeStyle } = await get().themeService.generateThemeFromDescribe(describe);
      set({ selectedTheme: colorScheme });
      const current = get().outline;
      if (current) set({ outline: { ...current, colorScheme, themeStyle }, slides: current.slides });
    } catch (err: any) {
      set({ error: err?.message || "Failed to generate theme" });
    }
  },
}));
