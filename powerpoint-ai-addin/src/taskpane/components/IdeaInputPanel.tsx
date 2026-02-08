import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  Subtitle2,
  Textarea,
  Title2,
  makeStyles,
  tokens
} from '@fluentui/react-components';
import { useStore } from '../store/useStore';

const useStyles = makeStyles({
  page: {
    display: 'grid',
    gap: '12px'
  },
  hero: {
    padding: '16px',
    borderRadius: tokens.borderRadiusXLarge,
    background:
      'linear-gradient(135deg, rgba(29,116,212,0.15) 0%, rgba(90,165,255,0.10) 45%, rgba(122,185,255,0.08) 100%)',
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  heroText: {
    display: 'grid',
    gap: '4px'
  },
  shell: {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: '240px 1fr 320px',
    alignItems: 'start',
    '@media (max-width: 980px)': {
      gridTemplateColumns: '1fr'
    }
  },
  panel: {
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow8,
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  panelBody: {
    padding: '12px',
    display: 'grid',
    gap: '10px'
  },
  slideList: {
    display: 'grid',
    gap: '8px'
  },
  slideItem: {
    width: '100%',
    textAlign: 'left',
    padding: '10px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer'
  },
  slideItemActive: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorNeutralBackground2
  },
  row: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  styleGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  styleCardBtn: {
    textAlign: 'left',
    padding: '10px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer'
  },
  swatches: {
    display: 'flex',
    gap: '6px',
    marginTop: '6px'
  },
  swatch: {
    width: '14px',
    height: '14px',
    borderRadius: '999px',
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  thumbRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  thumb: {
    width: '120px',
    height: '68px',
    objectFit: 'cover',
    borderRadius: '10px',
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  error: {
    padding: '10px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorPaletteRedBorder2}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground2
  }
});

export function IdeaInputPanel() {
  const styles = useStyles();

  const {
    status,
    error,
    streamStage,
    streamWarnings,
    streamQa,
    deck,
    stylePresets,
    selectedStyleId,
    designPrompt,
    generateDeck,
    applyStylePreset,
    generateDesign,
    updateTheme,
    insertCurrentDeck,
    downloadPptx,
    uploadPptxForViewing,
    uploadedPptxViewerUrl,
    uploadedPptxWarnings,
    aiEditSlide,
    slideEditBefore,
    slideEditAfter,
    slideEditPatch,
    searchPhotosForSlide,
    selectPhotoForSlide,
    autoPickVisualForSlide,
    generateAiImageForSlide,
    generateSpeakerNotesSmart,
    photoResultsBySlideId
  } = useStore();

  const isGenerating = status === 'generating';

  const [prompt, setPrompt] = useState('');
  const [designText, setDesignText] = useState('');
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);

  const selectedSlide = useMemo(() => {
    if (!deck) return null;
    return deck.slides.find((s) => s.id === selectedSlideId) ?? deck.slides[0] ?? null;
  }, [deck, selectedSlideId]);

  // Ensure a selected slide when a deck appears
  useEffect(() => {
    if (!deck) return;
    setSelectedSlideId((prev) => prev ?? deck.slides[0]?.id ?? null);
  }, [deck]);

  const examplePrompts = useMemo(
    () => [
      'AI startup pitch deck: problem, solution, moat, GTM, traction',
      'Quarterly business review: revenue, pipeline, wins, Q2 plan',
      'Product roadmap: themes, milestones, risks, dependencies',
      'Onboarding for new engineers: architecture, tools, best practices'
    ],
    []
  );

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroText}>
            <Subtitle2>STJHacks Prototype</Subtitle2>
            <Title2>Deck Generator (web demo)</Title2>
            <Body1 style={{ color: tokens.colorNeutralForeground2 }}>
              Generate everything at once: slides + visuals + style presets, then edit in one unified editor.
            </Body1>
          </div>
          <Badge appearance="filled" color="brand">
            Stock-first visuals
          </Badge>
        </div>
      </div>

      {/* Generate is ALWAYS visible */}
      <Card className={styles.panel}>
        <CardHeader
          header={<Subtitle2>Generate / Regenerate</Subtitle2>}
          description={
            <Caption1>
              {deck ? 'Regenerate replaces the deck (theme can be re-applied from style presets).' : 'Create a new deck from a prompt.'}
            </Caption1>
          }
        />
        <div className={styles.panelBody}>
          <Field label="Prompt">
            <Textarea
              resize="vertical"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
              placeholder="Describe the deck you want..."
              disabled={isGenerating}
            />
          </Field>

          <div className={styles.row}>
            {examplePrompts.map((p) => (
              <Button key={p} appearance="secondary" size="small" disabled={isGenerating} onClick={() => setPrompt(p)}>
                {p.length > 28 ? p.slice(0, 28) + '…' : p}
              </Button>
            ))}
          </div>

          <div className={styles.row}>
            <Button appearance="primary" disabled={!prompt.trim() || isGenerating} onClick={() => generateDeck(prompt)}>
              {isGenerating ? 'Generating…' : deck ? 'Regenerate Deck' : 'Generate Deck'}
            </Button>
            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
              {isGenerating ? 'Working…' : 'Auto-selects visuals per slide (Pexels if PEXEL_API set, else Wikimedia; optional OpenAI fallback).'}
            </Caption1>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          {/* Stream progress */}
          {status === 'generating' ? (
            <div style={{ marginTop: 10 }}>
              <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Stage: {streamStage ?? '…'}</Caption1>
            </div>
          ) : null}

          {/* QA summary */}
          {streamQa ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
              <Subtitle2>QA</Subtitle2>
              <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                Score: {String((streamQa as any).score ?? '—')} | Pass: {String((streamQa as any).pass ?? '—')}
              </Caption1>
              {Array.isArray((streamQa as any).issues) && (streamQa as any).issues.length ? (
                <ul style={{ marginTop: 6, marginBottom: 0 }}>
                  {(streamQa as any).issues.slice(0, 6).map((i: any, idx: number) => (
                    <li key={idx} style={{ fontSize: 12 }}>
                      <strong>{String(i.level ?? '')}</strong>: {String(i.message ?? '')}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {/* Recent warnings */}
          {streamWarnings?.length ? (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
              <Subtitle2>Warnings</Subtitle2>
              <ul style={{ marginTop: 6, marginBottom: 0 }}>
                {streamWarnings.slice(-6).map((w: any, idx: number) => (
                  <li key={idx} style={{ fontSize: 12 }}>
                    <strong>{w.stage || 'stage'}</strong>: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </Card>

      {!deck ? null : (
        <div className={styles.shell}>
          {/* Left: Slides */}
          <Card className={styles.panel}>
            <CardHeader header={<Subtitle2>Slides</Subtitle2>} description={<Caption1>Click a slide to edit</Caption1>} />
            <div className={styles.panelBody}>
              <div className={styles.slideList}>
                {deck.slides.map((s) => {
                  const active = s.id === (selectedSlide?.id ?? '');
                  const cls = active ? `${styles.slideItem} ${styles.slideItemActive}` : styles.slideItem;
                  return (
                    <button key={s.id} type="button" className={cls} onClick={() => setSelectedSlideId(s.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span>
                          {s.order + 1}. {s.title || '(Untitled)'}
                        </span>
                        <span style={{ color: tokens.colorNeutralForeground3 }}>
                          {s.selectedAssets?.some((a) => a.kind === 'photo') ? '✓' : ''}
                        </span>
                      </div>
                      <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{s.slideType}</Caption1>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Middle: Slide editor */}
          <Card className={styles.panel}>
            <CardHeader
              header={<Subtitle2>Editor</Subtitle2>}
              description={<Caption1>{selectedSlide ? `Editing slide ${selectedSlide.order + 1}` : 'Select a slide'}</Caption1>}
            />
            <div className={styles.panelBody}>
              {!selectedSlide ? (
                <Caption1>Select a slide to edit.</Caption1>
              ) : (
                <>
                  <Field label="Slide title">
                    <Input value={selectedSlide.title} disabled readOnly />
                  </Field>

                  <Card className={styles.panel}>
                    <CardHeader header={<Subtitle2>Slide preview</Subtitle2>} description={<Caption1>Rendered from layoutPlan + selectedAssets</Caption1>} />
                    <div className={styles.panelBody}>
                      {(() => {
                        const plan = (selectedSlide as any).layoutPlan as any | undefined;
                        const photoDataUri = selectedSlide.selectedAssets?.find((a) => a.kind === 'photo' && (a as any).dataUri)?.dataUri as
                          | string
                          | undefined;

                        const SLIDE_W = 13.333;
                        const SLIDE_H = 7.5;
                        const pxW = 320;
                        const pxH = Math.round((pxW * SLIDE_H) / SLIDE_W);
                        const scale = pxW / SLIDE_W;

                        const boxStyle = (b: any): React.CSSProperties => ({
                          position: 'absolute',
                          left: Math.round(Number(b.x || 0) * scale),
                          top: Math.round(Number(b.y || 0) * scale),
                          width: Math.round(Number(b.w || 1) * scale),
                          height: Math.round(Number(b.h || 1) * scale),
                          overflow: 'hidden',
                          borderRadius: 8
                        });

                        const textForKind = (kind: string) => {
                          if (kind === 'title') return selectedSlide.title || '';
                          if (kind === 'subtitle') return (selectedSlide as any).subtitle || '';
                          if (kind === 'bullets') return (selectedSlide.bullets ?? []).map((t) => `• ${t}`).join('\n');
                          if (kind === 'body') return selectedSlide.bodyText || '';
                          return '';
                        };

                        return (
                          <div
                            style={{
                              width: pxW,
                              height: pxH,
                              position: 'relative',
                              borderRadius: 12,
                              border: `1px solid ${tokens.colorNeutralStroke2}`,
                              background: tokens.colorNeutralBackground2,
                              boxShadow: tokens.shadow4
                            }}
                          >
                            {!plan?.boxes?.length ? (
                              <div style={{ padding: 10 }}>
                                <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                                  No layoutPlan for this slide yet.
                                </Caption1>
                              </div>
                            ) : (
                              plan.boxes.map((b: any, idx: number) => {
                                const kind = String(b.kind || '');

                                if (kind === 'image') {
                                  return photoDataUri ? (
                                    <div key={idx} style={boxStyle(b)}>
                                      <img src={photoDataUri} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                  ) : (
                                    <div
                                      key={idx}
                                      style={{
                                        ...boxStyle(b),
                                        border: `1px dashed ${tokens.colorNeutralStroke2}`,
                                        display: 'grid',
                                        placeItems: 'center'
                                      }}
                                    >
                                      <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>No image</Caption1>
                                    </div>
                                  );
                                }

                                if (kind === 'shape') {
                                  return (
                                    <div
                                      key={idx}
                                      style={{
                                        ...boxStyle(b),
                                        background: (b.fill as string) ? String(b.fill) : 'rgba(0,0,0,0.04)',
                                        border: `1px solid ${tokens.colorNeutralStroke2}`
                                      }}
                                    />
                                  );
                                }

                                const text = textForKind(kind);
                                if (!text.trim()) return null;

                                return (
                                  <div key={idx} style={{ ...boxStyle(b), padding: 6 }}>
                                    <pre
                                      style={{
                                        margin: 0,
                                        whiteSpace: 'pre-wrap',
                                        fontSize: kind === 'title' ? 14 : 10,
                                        lineHeight: kind === 'title' ? '16px' : '12px',
                                        color: tokens.colorNeutralForeground1,
                                        fontFamily: 'Segoe UI, Arial, sans-serif'
                                      }}
                                    >
                                      {text}
                                    </pre>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </Card>

                  <Field label="AI edit this slide" hint="Try: 'make it a quote' or 'make it shorter'">
                    <Input
                      placeholder="Instruction…"
                      disabled={isGenerating}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          (e.target as HTMLInputElement).value = '';
                          aiEditSlide(selectedSlide.id, val);
                        }
                      }}
                    />
                  </Field>

                  {/* Slide edit diff */}
                  {slideEditBefore || slideEditAfter || slideEditPatch ? (
                    <Card className={styles.panel}>
                      <CardHeader header={<Subtitle2>Edit diff</Subtitle2>} description={<Caption1>Before/after + patch streamed from backend</Caption1>} />
                      <div className={styles.panelBody}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Before</Caption1>
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                fontSize: 11,
                                border: `1px solid ${tokens.colorNeutralStroke2}`,
                                borderRadius: 10,
                                padding: 8
                              }}
                            >
                              {JSON.stringify(
                                {
                                  title: (slideEditBefore as any)?.title,
                                  bullets: (slideEditBefore as any)?.bullets,
                                  bodyText: (slideEditBefore as any)?.bodyText,
                                  speakerNotes: (slideEditBefore as any)?.speakerNotes
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                          <div>
                            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>After</Caption1>
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                fontSize: 11,
                                border: `1px solid ${tokens.colorNeutralStroke2}`,
                                borderRadius: 10,
                                padding: 8
                              }}
                            >
                              {JSON.stringify(
                                {
                                  title: (slideEditAfter as any)?.title,
                                  bullets: (slideEditAfter as any)?.bullets,
                                  bodyText: (slideEditAfter as any)?.bodyText,
                                  speakerNotes: (slideEditAfter as any)?.speakerNotes
                                },
                                null,
                                2
                              )}
                            </pre>
                          </div>
                        </div>

                        {slideEditPatch ? (
                          <div>
                            <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Patch</Caption1>
                            <pre
                              style={{
                                margin: 0,
                                whiteSpace: 'pre-wrap',
                                fontSize: 11,
                                border: `1px solid ${tokens.colorNeutralStroke2}`,
                                borderRadius: 10,
                                padding: 8
                              }}
                            >
                              {JSON.stringify(slideEditPatch, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  ) : null}

                  <Card className={styles.panel}>
                    <CardHeader
                      header={<Subtitle2>Stock photo</Subtitle2>}
                      description={
                        <Caption1>
                          Selected: {selectedSlide.selectedAssets?.some((a) => a.kind === 'photo') ? 'Yes' : 'No'}
                        </Caption1>
                      }
                    />
                    <div className={styles.panelBody}>
                      <div className={styles.row}>
                        <Button
                          appearance="secondary"
                          size="small"
                          disabled={isGenerating}
                          onClick={() => searchPhotosForSlide(selectedSlide.id, `${deck.title} ${selectedSlide.title}`)}
                        >
                          Search stock photos
                        </Button>
                        <Button
                          appearance="secondary"
                          size="small"
                          disabled={isGenerating}
                          onClick={() => autoPickVisualForSlide(selectedSlide.id)}
                        >
                          Auto-pick visual
                        </Button>
                        <Button
                          appearance="secondary"
                          size="small"
                          disabled={isGenerating}
                          onClick={() => generateSpeakerNotesSmart(selectedSlide.id)}
                        >
                          {selectedSlide.speakerNotes && selectedSlide.speakerNotes.trim().length > 0
                            ? 'Regenerate notes (this slide)'
                            : 'Generate notes (missing)'}
                        </Button>
                      </div>
                      <Field label="AI image prompt (optional)" hint="Press Enter to generate and set this slide image">
                        <Input
                          placeholder={`e.g. "Modern illustration of ${selectedSlide.title}"`}
                          disabled={isGenerating}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value;
                              (e.target as HTMLInputElement).value = '';
                              generateAiImageForSlide(selectedSlide.id, val);
                            }
                          }}
                        />
                      </Field>

                      {photoResultsBySlideId[selectedSlide.id]?.length ? (
                        <div className={styles.thumbRow}>
                          {photoResultsBySlideId[selectedSlide.id].map((r) => (
                            <button
                              key={r.providerId}
                              type="button"
                              onClick={() => selectPhotoForSlide(selectedSlide.id, r)}
                              style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
                              title={r.title}
                            >
                              <img className={styles.thumb} src={r.previewUrl ?? r.downloadUrl} alt={r.altText} />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </>
              )}
            </div>
          </Card>

          {/* Right: Style + theme + export */}
          <Card className={styles.panel}>
            <CardHeader header={<Subtitle2>Design</Subtitle2>} description={<Caption1>Style presets + theme</Caption1>} />
            <div className={styles.panelBody}>
              <Card className={styles.panel}>
                <CardHeader
                  header={<Subtitle2>AI Design</Subtitle2>}
                  description={<Caption1>Generate scheme + gradient + decoration via LLM, then apply.</Caption1>}
                />
                <div className={styles.panelBody}>
                  <Field label="Design prompt" hint="E.g. 'sleek dark neon, high contrast, minimal cards'">
                    <Input
                      value={designText}
                      onChange={(_, d) => setDesignText(d.value)}
                      placeholder="Describe the style you want…"
                      disabled={isGenerating}
                    />
                  </Field>
                  <div className={styles.row}>
                    <Button
                      appearance="primary"
                      disabled={!designText.trim() || isGenerating || !deck}
                      onClick={() => generateDesign(designText)}
                    >
                      {isGenerating ? 'Generating…' : 'Generate design'}
                    </Button>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                      Uses CLAUDE_API_KEY if set, else API_KEY (OpenAI)
                    </Caption1>
                  </div>

                  {/* Show the latest style presets returned by deck generation or design generation */}
                  <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Recent designs</Caption1>
                  <div className={styles.styleGrid}>
                    {(stylePresets ?? []).slice(0, 4).map((p: any) => {
                      const isActive = p.id === selectedStyleId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={styles.styleCardBtn}
                          onClick={() => applyStylePreset(p.id)}
                          style={{ border: isActive ? `2px solid ${tokens.colorBrandStroke1}` : undefined }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <strong>{p.name}</strong>
                            {isActive ? <span>✓</span> : null}
                          </div>
                          <div className={styles.swatches}>
                            <span className={styles.swatch} style={{ background: `hsl(${p.theme.primaryColor})` }} />
                            <span className={styles.swatch} style={{ background: `hsl(${p.theme.accentColor})` }} />
                            <span className={styles.swatch} style={{ background: `hsl(${p.theme.backgroundColor})` }} />
                          </div>
                          <div style={{ marginTop: 6, height: 26, borderRadius: 10, border: `1px solid ${tokens.colorNeutralStroke2}`, background: p.decoration?.gradientCss }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card className={styles.panel}>
                <CardHeader header={<Subtitle2>Theme tokens</Subtitle2>} description={<Caption1>Edit deck theme directly</Caption1>} />
                <div className={styles.panelBody}>
                  <Field label="Primary (HSL triplet)">
                    <Input value={deck.theme.primaryColor} onChange={(_, d) => updateTheme({ primaryColor: d.value })} />
                  </Field>
                  <Field label="Accent (HSL triplet)">
                    <Input value={deck.theme.accentColor} onChange={(_, d) => updateTheme({ accentColor: d.value })} />
                  </Field>
                  <Field label="Background (HSL triplet)">
                    <Input value={deck.theme.backgroundColor} onChange={(_, d) => updateTheme({ backgroundColor: d.value })} />
                  </Field>
                  <Field label="Heading font">
                    <Input value={deck.theme.fontHeading} onChange={(_, d) => updateTheme({ fontHeading: d.value })} />
                  </Field>
                  <Field label="Body font">
                    <Input value={deck.theme.fontBody} onChange={(_, d) => updateTheme({ fontBody: d.value })} />
                  </Field>
                </div>
              </Card>

              <Card className={styles.panel}>
                <CardHeader header={<Subtitle2>Export</Subtitle2>} description={<Caption1>Download deck JSON / PPTX</Caption1>} />
                <div className={styles.panelBody}>
                  <div className={styles.row}>
                    <Button
                      appearance="primary"
                      disabled={isGenerating}
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${deck.title.replace(/[^a-z0-9]/gi, '_')}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download deck JSON
                    </Button>

                    <Button appearance="secondary" disabled={isGenerating} onClick={() => insertCurrentDeck()}>
                      Insert into PowerPoint
                    </Button>
                    <Button appearance="secondary" disabled={isGenerating} onClick={() => downloadPptx()}>
                      Download PPTX (web)
                    </Button>
                  </div>
                  <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                    “Insert into PowerPoint” works when running inside the Office add-in. “Download PPTX” works in the web demo.
                  </Caption1>

                  <Card className={styles.panel}>
                    <CardHeader header={<Subtitle2>Upload PPTX to view</Subtitle2>} description={<Caption1>Best effort: converts to PDF if LibreOffice is installed.</Caption1>} />
                    <div className={styles.panelBody}>
                      <input
                        type="file"
                        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        disabled={isGenerating}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadPptxForViewing(f);
                        }}
                      />

                      {uploadedPptxWarnings?.length ? (
                        <div style={{ color: tokens.colorNeutralForeground2 }}>
                          <Caption1>Notes:</Caption1>
                          <ul>
                            {uploadedPptxWarnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {uploadedPptxViewerUrl ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <a href={uploadedPptxViewerUrl} target="_blank" rel="noreferrer">
                            Open uploaded file
                          </a>
                          {/* If this is a PDF, it will render inline in most browsers */}
                          <iframe
                            title="pptx-viewer"
                            src={uploadedPptxViewerUrl}
                            style={{ width: '100%', height: 320, borderRadius: 12, border: `1px solid ${tokens.colorNeutralStroke2}` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <div>
                    <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Attribution (selected photos)</Caption1>
                    <ul>
                      {deck.slides
                        .flatMap((s) => s.selectedAssets ?? [])
                        .filter((a) => a.kind === 'photo')
                        .map((a, i) => (
                          <li key={i}>{a.attribution ?? a.sourceUrl ?? 'Photo'}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
