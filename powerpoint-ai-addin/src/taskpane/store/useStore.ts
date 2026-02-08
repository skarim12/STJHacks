import { create } from 'zustand';
import { AIService } from '../services/AIService';
import { DeckApiClient } from '../services/DeckApiClient';
import { getPowerPointService } from '../services/PowerPointService';
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
  deck: DeckSchema | null;
  photoResultsBySlideId: Record<string, PhotoSearchResult[]>;

  ppt: ReturnType<typeof getPowerPointService>;

  generateFromIdea: (idea: string) => Promise<void>; // legacy
  generateDeck: (prompt: string) => Promise<void>;

  searchPhotosForSlide: (slideId: string, query: string) => Promise<void>;
  selectPhotoForSlide: (slideId: string, r: PhotoSearchResult) => Promise<void>;

  aiEditSlide: (slideId: string, instruction: string) => Promise<void>;

  insertCurrentDeck: () => Promise<void>;
};

export const useStore = create<Store>((set, get) => ({
  status: 'idle',
  error: null,

  ai: new AIService({ baseUrl: `http://localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),

  deckApi: new DeckApiClient({ baseUrl: `http://localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),
  deck: null,
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
      set({ deck: resp.deck, status: 'done' });
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
