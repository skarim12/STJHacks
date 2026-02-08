import React, { useMemo, useRef, useState } from 'react';
import type { DeckSchema } from '../taskpane/types/deck';
import { DeckApiClient } from '../taskpane/services/DeckApiClient';
import { SlideThumb } from './SlideThumb';

declare global {
  interface Window {
    __BACKEND_PORT__?: string;
  }
}

function backendBaseUrl(): string {
  const port = String(window.__BACKEND_PORT__ || '3000');
  const proto = window.location.protocol; // matches dev server (http/https)
  return `${proto}//${window.location.hostname}:${port}`;
}

type StreamEvt = { event: string; data: any };

export function WebApp() {
  const api = useMemo(() => new DeckApiClient({ baseUrl: backendBaseUrl() }), []);

  const [prompt, setPrompt] = useState('');
  const [designPrompt, setDesignPrompt] = useState('Modern clean, high contrast, subtle gradients, minimal cards.');
  const [tone, setTone] = useState<'formal' | 'casual' | 'technical' | 'creative'>('technical');
  const [targetAudience, setTargetAudience] = useState('Judges / demo audience');
  const [slideCount, setSlideCount] = useState<number>(10);

  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [events, setEvents] = useState<StreamEvt[]>([]);

  const [deckId, setDeckId] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckSchema | null>(null);
  const lastDoneDeckIdRef = useRef<string | null>(null);

  const pushEvent = (evt: StreamEvt) => {
    setEvents((e) => [...e.slice(-200), evt]);
  };

  const onGenerate = async () => {
    setBusy(true);
    setStage('');
    setWarnings([]);
    setEvents([]);
    setDeck(null);
    setDeckId(null);

    try {
      lastDoneDeckIdRef.current = null;

      await api.generateDeckStream(
        {
          prompt,
          designPrompt,
          slideCount,
          tone,
          targetAudience
        },
        (evt) => {
          pushEvent(evt);

          if (evt.event === 'stage:start') setStage(String(evt.data?.stage || ''));
          if (evt.event === 'warning') {
            const msg = String(evt.data?.message || 'warning');
            setWarnings((w) => [...w, msg]);
          }
          if (evt.event === 'done') {
            const id = String(evt.data?.deckId || '');
            if (id) {
              lastDoneDeckIdRef.current = id;
              setDeckId(id);
            }
          }
        }
      );

      // After stream completes, fetch full deck.
      const finalId = lastDoneDeckIdRef.current;
      if (finalId) {
        const r = await api.getDeck(finalId);
        if (r?.deck) setDeck(r.deck);
      }
    } catch (e: any) {
      setWarnings((w) => [...w, e?.message ?? String(e)]);
    } finally {
      setBusy(false);
    }
  };

  const onDownloadPptx = async () => {
    if (!deckId) return;
    const blob = await api.downloadPptx(deckId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(deck?.title || 'deck').replace(/[^a-z0-9-_]+/gi, '_')}.pptx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif', padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>STJHacks PowerPoint AI – Web Demo</h1>
        <div style={{ color: '#666', fontSize: 12 }}>Backend: {backendBaseUrl()}</div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#333' }}>Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
            placeholder="One prompt to generate a complete deck..."
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Slide count</label>
              <input
                type="number"
                value={slideCount}
                min={3}
                max={25}
                onChange={(e) => setSlideCount(Number(e.target.value || 10))}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12 }}>Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
              >
                <option value="technical">Technical</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="creative">Creative</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'block', fontSize: 12 }}>Target audience</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: 'block', fontSize: 12 }}>Design prompt</label>
            <input
              value={designPrompt}
              onChange={(e) => setDesignPrompt(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              onClick={onGenerate}
              disabled={busy || !prompt.trim()}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #111',
                background: busy ? '#eee' : '#111',
                color: busy ? '#111' : '#fff',
                cursor: busy ? 'not-allowed' : 'pointer'
              }}
            >
              {busy ? 'Generating…' : 'Generate deck'}
            </button>

            <button
              onClick={onDownloadPptx}
              disabled={!deckId}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            >
              Download PPTX
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
            Current stage: <b>{stage || '—'}</b>
          </div>

          {warnings.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Warnings</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {warnings.slice(-8).map((w, i) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <div style={{ padding: 10, borderRadius: 10, border: '1px solid #eee', background: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontWeight: 600 }}>Deck</div>
              <div style={{ fontSize: 12, color: '#666' }}>deckId: {deckId || '—'}</div>
            </div>

            {deck ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{deck.title}</div>
                <div style={{ fontSize: 12, color: '#666' }}>{deck.slides.length} slides</div>

                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {deck.slides.slice(0, 10).map((s) => (
                    <div key={s.id} style={{ padding: 10, borderRadius: 12, border: '1px solid #eee', background: '#fff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.order + 1}. {s.title}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>{s.slideType}</div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <SlideThumb slide={s as any} widthPx={260} />
                      </div>
                    </div>
                  ))}
                </div>

                {deck.slides.length > 10 ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Showing first 10 slides.</div>
                ) : null}
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>Generate a deck to preview it here.</div>
            )}
          </div>

          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: '1px solid #eee' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Stream (last 200 events)</div>
            <div style={{ maxHeight: 360, overflow: 'auto', fontFamily: 'Consolas, ui-monospace, monospace', fontSize: 11 }}>
              {events.map((e, i) => (
                <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid #f4f4f4' }}>
                  <span style={{ color: '#111', fontWeight: 700 }}>{e.event}</span>{' '}
                  <span style={{ color: '#666' }}>{JSON.stringify(e.data)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: '#666' }}>
        Tip: keep your existing add-in flow at <code>/taskpane.html</code>. This web demo is served at <code>/web.html</code>.
      </div>
    </div>
  );
}
