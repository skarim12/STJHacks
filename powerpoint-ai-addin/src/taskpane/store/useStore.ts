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

  // Stream/progress state (SSE)
  streamStage: string | null;
  streamEvents: Array<{ event: string; data: any }>;
  streamWarnings: Array<{ stage: string; message: string }>;
  streamQa: any | null;

  // Slide edit diff support
  slideEditBefore: any | null;
  slideEditAfter: any | null;
  slideEditPatch: any | null;

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
  downloadPptx: () => Promise<void>;
  uploadPptxForViewing: (file: File) => Promise<void>;

  generateSpeakerNotesSmart: (slideId: string) => Promise<void>;

  uploadedPptxViewerUrl?: string | null;
  uploadedPptxWarnings?: string[] | null;
};

export const useStore = create<Store>((set, get) => ({
  status: 'idle',
  error: null,
  streamStage: null,
  streamEvents: [],
  streamWarnings: [],
  streamQa: null,
  slideEditBefore: null,
  slideEditAfter: null,
  slideEditPatch: null,

  // IMPORTANT: When the taskpane is served over https (required by Office add-ins),
  // browsers will block mixed-content calls to http://localhost:PORT.
  // So we match the current page protocol (https/http).
  ai: new AIService({ baseUrl: `${window.location.protocol}//localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),

  deckApi: new DeckApiClient({ baseUrl: `${window.location.protocol}//localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),
  styleApi: new StyleApiClient({ baseUrl: `${window.location.protocol}//localhost:${(window as any).__BACKEND_PORT__ || '3000'}` }),
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
    set({
      status: 'generating',
      error: null,
      streamStage: 'starting',
      streamEvents: [],
      streamWarnings: [],
      streamQa: null
    });

    try {
      await get().deckApi.generateDeckStream({ prompt }, (evt) => {
        set((s) => ({
          ...s,
          streamEvents: [...(s.streamEvents ?? []), evt].slice(-200)
        }));

        if (evt.event === 'stage:start' || evt.event === 'stage:end') {
          const stage = String(evt.data?.stage ?? '');
          if (stage) set({ streamStage: stage });
        }

        if (evt.event === 'warning') {
          set((s) => ({
            ...s,
            streamWarnings: [
              ...(s.streamWarnings ?? []),
              { stage: String(evt.data?.stage ?? ''), message: String(evt.data?.message ?? '') }
            ].slice(-200)
          }));
        }

        if (evt.event === 'artifact' && evt.data?.stage === 'qa' && evt.data?.name === 'report') {
          set({ streamQa: evt.data?.data ?? null });
        }

        if (evt.event === 'done') {
          const deckId = String(evt.data?.deckId ?? '').trim();
          const qa = evt.data?.qa ?? null;
          if (qa) set({ streamQa: qa });

          if (deckId) {
            get()
              .deckApi
              .getDeck(deckId)
              .then((resp) => {
                if (!resp?.success || !resp?.deck) throw new Error(resp?.error ?? 'Failed to fetch deck');
                set((s) => ({
                  ...s,
                  deck: resp.deck,
                  status: 'done'
                }));
              })
              .catch((e) => {
                set({ status: 'error', error: e?.message ?? String(e) });
              });
          }
        }
      });

      // Stream might finish before the deck fetch returns.
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

    set({
      status: 'generating',
      error: null,
      streamStage: 'slide_edit',
      streamEvents: [],
      streamWarnings: [],
      streamQa: null
    });

    try {
      await get().deckApi.aiEditSlideStream(deck.id, slideId, { instruction: trimmed }, (evt) => {
        if (evt.event === 'artifact' && evt.data?.stage === 'slide_edit') {
          if (evt.data?.name === 'before') set({ slideEditBefore: evt.data?.data ?? null });
          if (evt.data?.name === 'draft_patch') set({ slideEditPatch: evt.data?.data ?? null });
          if (evt.data?.name === 'after') set({ slideEditAfter: evt.data?.data ?? null });
        }
        set((s) => ({
          ...s,
          streamEvents: [...(s.streamEvents ?? []), evt].slice(-200)
        }));

        if (evt.event === 'warning') {
          set((s) => ({
            ...s,
            streamWarnings: [
              ...(s.streamWarnings ?? []),
              { stage: String(evt.data?.stage ?? ''), message: String(evt.data?.message ?? '') }
            ].slice(-200)
          }));
        }

        if (evt.event === 'done') {
          const patch = evt.data?.patch as Partial<Slide> | undefined;
          if (patch) {
            set((s) => {
              if (!s.deck) return s as any;
              const updated = {
                ...s.deck,
                slides: s.deck.slides.map((sl) =>
                  sl.id === slideId ? ({ ...sl, ...patch, id: sl.id, order: sl.order } as any) : sl
                ),
                metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
              };
              return { ...s, deck: updated, status: 'done' };
            });
          } else {
            set({ status: 'done' });
          }
        }
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
          decoration: (preset as any).decoration ?? (s.deck as any).decoration,
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
          decoration: (preset as any).decoration ?? (deck as any).decoration,
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
  },

  downloadPptx: async () => {
    const deck = get().deck;
    if (!deck) return;
    set({ status: 'generating', error: null });

    try {
      const blob = await get().deckApi.downloadPptx(deck.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(deck.title || 'deck').replace(/[^a-z0-9]/gi, '_')}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      set({ status: 'done' });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  uploadedPptxViewerUrl: null,
  uploadedPptxWarnings: null,

  uploadPptxForViewing: async (file: File) => {
    set({ status: 'generating', error: null, uploadedPptxViewerUrl: null, uploadedPptxWarnings: null });
    try {
      const resp = await get().deckApi.uploadPptx(file);
      if (!resp?.success) throw new Error(resp?.error ?? 'Upload failed');

      const pdfUrl = resp.pdfUrl as string | null;
      const pptxUrl = resp.pptxUrl as string | null;
      const viewerUrl = pdfUrl || pptxUrl;

      set({
        status: 'done',
        uploadedPptxViewerUrl: viewerUrl,
        uploadedPptxWarnings: (resp.warnings ?? null) as any
      });
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  },

  generateSpeakerNotesSmart: async (slideId: string) => {
    const deck = get().deck;
    if (!deck) return;

    const slide = deck.slides.find((s) => s.id === slideId);
    if (!slide) return;

    set({ status: 'generating', error: null });

    try {
      // If slide already has notes -> regenerate ONLY that slide.
      // If missing -> generate for the whole deck (fills blanks).
      if (slide.speakerNotes && slide.speakerNotes.trim().length > 0) {
        const resp = await get().deckApi.generateSpeakerNotesForSlide(deck.id, slideId);
        if (!resp?.success) throw new Error(resp?.error ?? 'Speaker notes generation failed');
        const newNotes = String(resp.speakerNotes ?? '').trim();
        if (!newNotes) throw new Error('No speaker notes returned');

        set((s) => {
          if (!s.deck) return s as any;
          return {
            ...s,
            status: 'done',
            deck: {
              ...s.deck,
              slides: s.deck.slides.map((sl) => (sl.id === slideId ? { ...sl, speakerNotes: newNotes } : sl)),
              metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
            }
          };
        });
      } else {
        const resp = await get().deckApi.generateSpeakerNotesForDeck(deck.id);
        if (!resp?.success) throw new Error(resp?.error ?? 'Speaker notes generation failed');
        // Backend updates DeckStore; easiest is to re-generate deck state by fetching updated deck via regenerate?
        // We don't have a GET deck endpoint yet; so we locally fill missing notes using current content.
        // (Pragmatic) Call per-slide regen for slides missing notes.
        const missing = deck.slides.filter((sl) => !sl.speakerNotes || !sl.speakerNotes.trim());
        for (const m of missing) {
          const r2 = await get().deckApi.generateSpeakerNotesForSlide(deck.id, m.id);
          if (r2?.success && r2?.speakerNotes) {
            const note = String(r2.speakerNotes);
            set((s) => {
              if (!s.deck) return s as any;
              return {
                ...s,
                deck: {
                  ...s.deck,
                  slides: s.deck.slides.map((sl) => (sl.id === m.id ? { ...sl, speakerNotes: note } : sl)),
                  metadata: { ...s.deck.metadata, updatedAt: new Date().toISOString() }
                }
              };
            });
          }
        }
        set({ status: 'done' });
      }
    } catch (e: any) {
      set({ status: 'error', error: e?.message ?? String(e) });
    }
  }
}));
