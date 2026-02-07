import { create } from "zustand";

export type SlideOutline = {
  title: string;
  bulletPoints: string[];
};

export type TemplateOption = {
  id: string;
  name: string;
  description: string;
};

export type GenerationStatus = "idle" | "generating" | "inserting" | "researching" | "error";

export interface ResearchData {
  title: string;
  summary: string;
  bullets: string[];
}

interface PresentationState {
  roughIdea: string;
  refinedPrompt: string;
  slideOutlines: SlideOutline[];
  status: GenerationStatus;
  errorMessage: string | null;

  selectedTemplate: TemplateOption | null;
  availableTemplates: TemplateOption[];

  researchTopic: string;
  researchResult: ResearchData | null;

  colorTheme: string;

  setRoughIdea: (value: string) => void;
  setRefinedPrompt: (value: string) => void;
  setSlideOutlines: (slides: SlideOutline[]) => void;
  setStatus: (status: GenerationStatus) => void;
  setErrorMessage: (message: string | null) => void;

  setSelectedTemplate: (tpl: TemplateOption | null) => void;
  setAvailableTemplates: (tpls: TemplateOption[]) => void;

  setResearchTopic: (topic: string) => void;
  setResearchResult: (result: ResearchData | null) => void;

  setColorTheme: (theme: string) => void;

  reset: () => void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  roughIdea: "",
  refinedPrompt: "",
  slideOutlines: [],
  status: "idle",
  errorMessage: null,

  selectedTemplate: null,
  availableTemplates: [
    {
      id: "default",
      name: "Default",
      description: "Simple bullets and titles."
    },
    {
      id: "executive",
      name: "Executive Summary",
      description: "High-level slides for leadership."
    },
    {
      id: "detailed",
      name: "Detailed Analysis",
      description: "More bullets and structure."
    }
  ],

  researchTopic: "",
  researchResult: null,

  colorTheme: "Office",

  setRoughIdea: (value) => set({ roughIdea: value }),
  setRefinedPrompt: (value) => set({ refinedPrompt: value }),
  setSlideOutlines: (slides) => set({ slideOutlines: slides }),
  setStatus: (status) => set({ status }),
  setErrorMessage: (message) => set({ errorMessage: message }),

  setSelectedTemplate: (tpl) => set({ selectedTemplate: tpl }),
  setAvailableTemplates: (tpls) => set({ availableTemplates: tpls }),

  setResearchTopic: (topic) => set({ researchTopic: topic }),
  setResearchResult: (result) => set({ researchResult: result }),

  setColorTheme: (theme) => set({ colorTheme: theme }),

  reset: () =>
    set({
      roughIdea: "",
      refinedPrompt: "",
      slideOutlines: [],
      status: "idle",
      errorMessage: null,
      researchTopic: "",
      researchResult: null
    })
}));