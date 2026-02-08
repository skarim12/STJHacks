import { create } from 'zustand';
import { AIService } from '../services/AIService';
import { DeckApiClient } from '../services/DeckApiClient';
import { getPowerPointService } from '../services/PowerPointService';
import { StyleApiClient } from '../services/StyleApiClient';
import type { DeckSchema, SelectedAsset, Slide } from '../types';

type Status = 'idle' | 'generating' | 'error' | 'done';

type PhotoSearchResult = {
  provider: 'pexels';
  providerId: string;
  kind: 'photo';
  title: string;
  previewUrl?: string;
  downloadUrl: string;
  sourceUrl?: string;
  width?: number;
  height?: number;
  license?: string;
  attribution?: string;
  attributionUrl?: string;
  altText: string;
};

type Store = {
  status: Status;
  error: string | null;

  // legacy
  ai: AIService;

  // new agent-style deck pipeline
  deckApi: DeckApiClient;
  styleApi: StyleApiClient;
  deck: DeckSchema | null;
  stylePresets: any[];
  recommendedStyleId: string | null;
  selectedStyleId: string | null;
  designPrompt: string;
  photoResultsBySlideId: Record<string, PhotoSearchResult[]>;

  ppt: ReturnType<typeof getPowerPointService>;

  generateFromIdea: (idea: string) => Promise<void>; // legacy
  generateDeck: (prompt: string) => Promise<void>;

  searchPhotosForSlide: (slideId: string, query: string) => Promise<void>;
  selectPhotoForSlide: (slideId: string, r: PhotoSearchResult) => Promise<void>;
  autoPickVisualForSlide: (slideId: string) => Promise<void>;
  generateAiImageForSlide: (slideId: string, prompt: string) => Promise<void>;

  aiEditSlide: (slideId: string, instruction: string) => Promise<void>;
  updateTheme: (patch: Partial<DeckSchema['theme']>) => void;
  applyStylePreset: (styleId: string) => void;
  generateDesign: (designPrompt: string) => Promise<void>;

  insertCurrentDeck: () => Promise<void>;
};

export const useStore = create<Store>((set, get) => ({
  status: 'idle',
  error: null,

  ai: new AIService({ baseUrl: `http://localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),

  deckApi: new DeckApiClient({ baseUrl: `http://localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),
  styleApi: new StyleApiClient({ baseUrl: `http://localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),
  deck: null,
  stylePresets: [],
  recommendedStyleId: null,
  selectedStyleId: null,
  designPrompt: '',
  photoResultsBySlideId: {},

  ppt: getPowerPointService(),

  // Legacy flow retained (outline -> immediate slide creation)
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
  },

  generateDeck: async (prompt: string) => {
    set({ status: 'generating', error: null });
    try {
      const resp = await get().deckApi.generateDeck({ prompt, slideCount: 6 });
      if (!resp.success || !resp.deck) throw new Error(resp.error ?? 'Deck generation failed');
      const stylePresets = (resp as any).stylePresets ?? [];
      const recommendedStyleId = (resp as any).recommendedStyleId ?? null;
      // Apply recommended theme immediately if provided
      const rec = stylePresets.find((s: any) => s.id === recommendedStyleId);
      const deck = rec?.theme ? { ...resp.deck, theme: { ...resp.deck.theme, ...rec.theme } } : resp.deck;
      set({ deck, stylePresets, recommendedStyleId, selectedStyleId: recommendedStyleId, status: 'done' });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  searchPhotosForSlide: async (slideId: string, query: string) => {
    set({ status: 'generating', error: null });
    try {
      const resp = await get().deckApi.searchPhotos(query, 6);
      const results = (resp?.results ?? []) as PhotoSearchResult[];
      set((s) => ({
        status: 'done',
        photoResultsBySlideId: { ...s.photoResultsBySlideId, [slideId]: results }
      }));
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  autoPickVisualForSlide: async (slideId: string) => {
    const deck = get().deck;
    if (!deck) return;
    set({ status: 'generating', error: null });
    try {
      const resp = await get().deckApi.autoPickVisual(deck.id, slideId);
      if (!resp?.success || !resp?.asset) throw new Error(resp?.error ?? 'Auto-pick visual failed');

      const asset = resp.asset as any;
      set((s) => {
        if (!s.deck) return s as any;
        return {
          ...s,
          status: 'done',
          deck: {
            ...s.deck,
            slides: s.deck.slides.map((sl) =>
              sl.id === slideId
                ? ({
                    ...sl,
                    selectedAssets: [
                      ...(sl.selectedAssets ?? []).filter((a) => a.kind !== 'photo'),
                      {
                        kind: 'photo',
                        dataUri: asset.dataUri,
                        sourceUrl: asset.sourceUrl,
                        attribution: asset.attribution,
                        license: asset.license,
                        altText: asset.altText
                      }
                    ]
                  } as any)
                : sl
            ),
            metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
          }
        };
      });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  generateAiImageForSlide: async (slideId: string, prompt: string) => {
    const deck = get().deck;
    if (!deck) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;

    set({ status: 'generating', error: null });
    try {
      const resp = await get().deckApi.generateAiImage({ prompt: trimmed });
      if (!resp?.success || !resp?.asset) throw new Error(resp?.error ?? 'AI image generation failed');

      const asset = resp.asset as any;
      set((s) => {
        if (!s.deck) return s as any;
        return {
          ...s,
          status: 'done',
          deck: {
            ...s.deck,
            slides: s.deck.slides.map((sl) =>
              sl.id === slideId
                ? ({
                    ...sl,
                    selectedAssets: [
                      ...(sl.selectedAssets ?? []).filter((a) => a.kind !== 'photo'),
                      {
                        kind: 'photo',
                        dataUri: asset.dataUri,
                        sourceUrl: asset.sourceUrl,
                        attribution: asset.attribution,
                        license: asset.license,
                        altText: asset.altText
                      }
                    ]
                  } as any)
                : sl
            ),
            metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
          }
        };
      });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  selectPhotoForSlide: async (slideId: string, r: PhotoSearchResult) => {
    set({ status: 'generating', error: null });
    try {
      const resp = await get().deckApi.fetchPhoto({
        downloadUrl: r.downloadUrl,
        altText: r.altText,
        attribution: r.attribution,
        license: r.license
      });
      if (!resp?.success || !resp?.asset) throw new Error(resp?.error ?? 'Failed to fetch asset');

      const asset: SelectedAsset = {
        kind: 'photo',
        dataUri: resp.asset.dataUri,
        sourceUrl: resp.asset.sourceUrl,
        attribution: resp.asset.attribution,
        license: resp.asset.license,
        altText: resp.asset.altText
      };

      set((s) => {
        if (!s.deck) return s as any;
        const deck = {
          ...s.deck,
          slides: s.deck.slides.map((sl) => {
            if (sl.id !== slideId) return sl;
            const selectedAssets = (sl.selectedAssets ?? []).filter((a) => a.kind !== 'photo');
            return { ...sl, selectedAssets: [...selectedAssets, asset] } as Slide;
          })
        };
        return { ...s, deck, status: 'done' };
      });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  aiEditSlide: async (slideId: string, instruction: string) => {
    const deck = get().deck;
    if (!deck) return;
    const trimmed = instruction.trim();
    if (!trimmed) return;

    set({ status: 'generating', error: null });
    try {
      const resp = await get().deckApi.aiEditSlide(deck.id, slideId, { instruction: trimmed });
      if (!resp?.success) throw new Error(resp?.error ?? 'Slide edit failed');

      const patch = resp.patch as Partial<Slide>;

      set((s) => {
        if (!s.deck) return s as any;
        const updated = {
          ...s.deck,
          slides: s.deck.slides.map((sl) => (sl.id === slideId ? ({ ...sl, ...patch, id: sl.id, order: sl.order } as any) : sl)),
          metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
        };
        return { ...s, deck: updated, status: 'done' };
      });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  updateTheme: (patch) => {
    set((s) => {
      if (!s.deck) return s as any;
      return {
        ...s,
        deck: {
          ...s.deck,
          theme: { ...s.deck.theme, ...patch },
          metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
        }
      };
    });
  },

  applyStylePreset: (styleId: string) => {
    set((s) => {
      if (!s.deck) return s as any;
      const preset = (s.stylePresets ?? []).find((p: any) => p.id === styleId);
      if (!preset) return s as any;
      return {
        ...s,
        selectedStyleId: styleId,
        deck: {
          ...s.deck,
          theme: { ...s.deck.theme, ...preset.theme },
          metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
        }
      };
    });
  },

  generateDesign: async (designPrompt: string) => {
    const deck = get().deck;
    if (!deck) {
      set({ error: 'Generate a deck first, then generate design.' });
      return;
    }

    const trimmed = designPrompt.trim();
    if (!trimmed) return;

    set({ status: 'generating', error: null, designPrompt: trimmed });
    try {
      const resp = await get().styleApi.generateStyle({
        deckTitle: deck.title,
        deckPrompt: deck.description ?? deck.title,
        designPrompt: trimmed
      });
      if (!resp?.success || !resp?.stylePreset) throw new Error(resp?.error ?? 'Style generation failed');

      const preset = resp.stylePreset;
      set((s) => ({
        ...s,
        status: 'done',
        stylePresets: [preset, ...(s.stylePresets ?? [])],
        selectedStyleId: preset.id,
        recommendedStyleId: preset.id,
        deck: {
          ...deck,
          theme: { ...deck.theme, ...preset.theme },
          metadata: { ...deck.metadata, updatedAt: new Date().toISOString() }
        }
      }));
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  insertCurrentDeck: async () => {
    const deck = get().deck;
    if (!deck) return;
    set({ status: 'generating', error: null });
    try {
      await get().ppt.insertDeck(deck);
      set({ status: 'done' });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  }
}));
