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
    deck,
    stylePresets,
    selectedStyleId,
    generateDeck,
    applyStylePreset,
    updateTheme,
    aiEditSlide,
    searchPhotosForSlide,
    selectPhotoForSlide,
    photoResultsBySlideId
  } = useStore();

  const isGenerating = status === 'generating';

  const [prompt, setPrompt] = useState('');
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
              {isGenerating ? 'Working…' : 'Auto-selects up to 3 stock photos (PEXEL_API required).'}
            </Caption1>
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}
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
                      </div>

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
                <CardHeader header={<Subtitle2>Style gallery</Subtitle2>} description={<Caption1>Pick a generated style preset</Caption1>} />
                <div className={styles.panelBody}>
                  <div className={styles.styleGrid}>
                    {(stylePresets ?? []).map((p: any) => {
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
                          <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>{p.decoration?.backgroundStyle ?? ''}</Caption1>
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
                <CardHeader header={<Subtitle2>Export</Subtitle2>} description={<Caption1>Download deck JSON</Caption1>} />
                <div className={styles.panelBody}>
                  <Button
                    appearance="primary"
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
