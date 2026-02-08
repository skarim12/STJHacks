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

  const [qaReport, setQaReport] = useState<any | null>(null);
  const [qaBusy, setQaBusy] = useState(false);
  const [improveBusy, setImproveBusy] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);

  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);

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
    setQaReport(null);

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
        if (r?.deck) {
          setDeck(r.deck);
          setSelectedSlideId(r.deck?.slides?.[0]?.id ?? null);
        }
        try {
          const q = await api.runQa(finalId);
          if (q?.report) setQaReport(q.report);
        } catch {
          // QA is best-effort in demo UI
        }
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

  const onDownloadReport = async () => {
    if (!deckId) return;
    try {
      const r = await api.getReport(deckId);
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(deck?.title || 'deck').replace(/[^a-z0-9-_]+/gi, '_')}.report.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setWarnings((w) => [...w, e?.message ?? String(e)]);
    }
  };

  const onRunQa = async () => {
    if (!deckId) return;
    setQaBusy(true);
    try {
      const q = await api.runQa(deckId);
      if (q?.report) setQaReport(q.report);
      else setWarnings((w) => [...w, q?.error ? String(q.error) : 'QA failed']);
    } catch (e: any) {
      setWarnings((w) => [...w, e?.message ?? String(e)]);
    } finally {
      setQaBusy(false);
    }
  };

  const onImprove = async () => {
    if (!deckId) return;
    setImproveBusy(true);
    try {
      const r = await api.improveDeck(deckId);
      if (r?.warnings?.length) setWarnings((w) => [...w, ...r.warnings.map((x: any) => String(x))]);
      if (r?.report) setQaReport(r.report);
      const d = await api.getDeck(deckId);
      if (d?.deck) setDeck(d.deck);
    } catch (e: any) {
      setWarnings((w) => [...w, e?.message ?? String(e)]);
    } finally {
      setImproveBusy(false);
    }
  };

  const onRepair = async () => {
    if (!deckId) return;
    setRepairBusy(true);
    try {
      const r = await api.repairDeck(deckId);
      if (r?.warnings?.length) setWarnings((w) => [...w, ...r.warnings.map((x: any) => String(x))]);
      if (r?.report) setQaReport(r.report);
      const d = await api.getDeck(deckId);
      if (d?.deck) setDeck(d.deck);
    } catch (e: any) {
      setWarnings((w) => [...w, e?.message ?? String(e)]);
    } finally {
      setRepairBusy(false);
    }
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

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
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
              onClick={onRunQa}
              disabled={!deckId || qaBusy}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            >
              {qaBusy ? 'Running QA…' : 'Run QA'}
            </button>

            <button
              onClick={onImprove}
              disabled={!deckId || improveBusy}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            >
              {improveBusy ? 'Improving…' : 'Improve'}
            </button>

            <button
              onClick={onRepair}
              disabled={!deckId || repairBusy}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            >
              {repairBusy ? 'Repairing…' : 'Repair'}
            </button>

            <button
              onClick={onDownloadPptx}
              disabled={!deckId}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            >
              Download PPTX
            </button>

            <button
              onClick={onDownloadReport}
              disabled={!deckId}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
            >
              Download report (QA + assets)
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

          {qaReport ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid #e5e5e5', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700 }}>QA Report</div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  Score: <b>{String(qaReport.score ?? '—')}</b> · Pass: <b>{String(qaReport.pass ?? '—')}</b>
                </div>
              </div>
              {Array.isArray(qaReport.issues) && qaReport.issues.length ? (
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12 }}>
                  {qaReport.issues.slice(0, 12).map((iss: any, i: number) => {
                    const sid = iss.slideId ? String(iss.slideId) : null;
                    const slide = sid && deck ? deck.slides.find((s) => s.id === sid) : null;
                    const slideLabel = slide ? `Slide ${Number(slide.order) + 1}` : sid ? 'Slide' : null;

                    return (
                      <li key={i} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{String(iss.level || 'info').toUpperCase()}</span>: {String(iss.message || '')}
                        {sid ? (
                          <button
                            type="button"
                            onClick={() => setSelectedSlideId(sid)}
                            style={{
                              marginLeft: 8,
                              fontSize: 11,
                              padding: '2px 8px',
                              borderRadius: 999,
                              border: '1px solid #ddd',
                              background: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            {slideLabel ?? 'Slide'}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>No issues reported.</div>
              )}
              {Array.isArray(qaReport.issues) && qaReport.issues.length > 12 ? (
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Showing first 12 issues.</div>
              ) : null}
            </div>
          ) : null}
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
                  {deck.slides.slice(0, 10).map((s) => {
                    const active = selectedSlideId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSlideId(s.id)}
                        style={{
                          padding: 10,
                          borderRadius: 12,
                          border: active ? '2px solid #111' : '1px solid #eee',
                          background: '#fff',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.order + 1}. {s.title}</div>
                          <div style={{ fontSize: 11, color: '#666' }}>{s.slideType}</div>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <SlideThumb slide={s as any} deck={deck as any} widthPx={260} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {deck.slides.length > 10 ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>Showing first 10 slides.</div>
                ) : null}

                {(() => {
                  const sel = selectedSlideId ? deck.slides.find((s) => s.id === selectedSlideId) : null;
                  if (!sel) return null;
                  return (
                    <div style={{ marginTop: 12, padding: 10, borderRadius: 12, border: '1px solid #eee', background: '#fff' }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Selected slide</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{sel.order + 1}. {sel.title}</div>
                      <div style={{ marginTop: 8 }}>
                        <SlideThumb slide={sel as any} deck={deck as any} widthPx={520} />
                      </div>
                      {sel.speakerNotes ? (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Speaker notes</div>
                          <div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{sel.speakerNotes}</div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>No speaker notes.</div>
                      )}
                    </div>
                  );
                })()}
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
