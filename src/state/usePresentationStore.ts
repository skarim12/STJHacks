import { create } from "zustand";

export type SlideOutline = {
  title: string;
  bulletPoints: string[];
};

export type GenerationStatus = "idle" | "generating" | "inserting" | "error";

interface PresentationState {
  roughIdea: string;
  refinedPrompt: string;
  slideOutlines: SlideOutline[];
  status: GenerationStatus;
  errorMessage: string | null;

  setRoughIdea: (value: string) => void;
  setRefinedPrompt: (value: string) => void;
  setSlideOutlines: (slides: SlideOutline[]) => void;
  setStatus: (status: GenerationStatus) => void;
  setErrorMessage: (message: string | null) => void;
  reset: () => void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  roughIdea: "",
  refinedPrompt: "",
  slideOutlines: [],
  status: "idle",
  errorMessage: null,

  setRoughIdea: (value) => set({ roughIdea: value }),
  setRefinedPrompt: (value) => set({ refinedPrompt: value }),
  setSlideOutlines: (slides) => set({ slideOutlines: slides }),
  setStatus: (status) => set({ status }),
  setErrorMessage: (message) => set({ errorMessage: message }),
  reset: () =>
    set({
      roughIdea: "",
      refinedPrompt: "",
      slideOutlines: [],
      status: "idle",
      errorMessage: null
    })
}));