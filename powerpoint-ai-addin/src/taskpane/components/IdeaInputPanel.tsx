import React, { useMemo, useState } from 'react';
import {
  Button,
  Field,
  Textarea,
  Spinner,
  Card,
  CardHeader,
  tokens,
  makeStyles,
  Subtitle2,
  Title2,
  Body1,
  Badge,
  Caption1,
  Input
} from '@fluentui/react-components';
import { useStore } from '../store/useStore';

const useStyles = makeStyles({
  wrap: {
    display: 'grid',
    gap: 12
  },
  hero: {
    padding: 16,
    borderRadius: tokens.borderRadiusXLarge,
    background:
      'linear-gradient(135deg, rgba(29,116,212,0.15) 0%, rgba(90,165,255,0.10) 45%, rgba(122,185,255,0.08) 100%)',
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  heroText: {
    display: 'grid',
    gap: 4
  },
  contentCard: {
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow8,
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  cardBody: {
    display: 'grid',
    gap: 12,
    padding: 16
  },
  actionsRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  },
  actionsLeft: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  examples: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8
  },
  exampleBtn: {
    borderRadius: 999,
    padding: '6px 10px',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground2,
    cursor: 'pointer',
    fontSize: 12,
    color: tokens.colorNeutralForeground2
  },
  exampleBtnHover: {
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
      color: tokens.colorNeutralForeground1,
      borderColor: tokens.colorBrandStroke1
    }
  },
  slideCard: {
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  slideGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 10,
    padding: 12
  },
  thumbRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap'
  },
  thumb: {
    width: 120,
    height: 68,
    objectFit: 'cover',
    borderRadius: 10,
    border: `1px solid ${tokens.colorNeutralStroke2}`
  },
  error: {
    padding: 10,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorPaletteRedBorder2}`,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground2
  }
});

export function IdeaInputPanel() {
  const styles = useStyles();
  const [idea, setIdea] = useState('');
  const {
    status,
    error,
    deck,
    generateDeck,
    searchPhotosForSlide,
    selectPhotoForSlide,
    photoResultsBySlideId,
    aiEditSlide,
    insertCurrentDeck
  } = useStore();

  const isGenerating = status === 'generating';

  const examples = useMemo(
    () => [
      'Quarterly Business Review: revenue, pipeline, wins, and Q2 plan',
      'AI startup pitch deck: problem, solution, moat, GTM, traction',
      'Engineering onboarding: tooling, codebase map, best practices',
      'Product roadmap: themes, milestones, risks, dependencies'
    ],
    []
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroText}>
            <Subtitle2>STJHacks Prototype</Subtitle2>
            <Title2>Deck Generator (future PowerPoint add-in)</Title2>
            <Body1 style={{ color: tokens.colorNeutralForeground2 }}>
              Generate a designed outline + choose stock images (Pexels) per slide, then insert into PowerPoint.
            </Body1>
          </div>
          <Badge appearance="filled" color="brand">
            Stock-first visuals
          </Badge>
        </div>
      </div>

      {!deck ? (
        <Card className={styles.contentCard}>
          <CardHeader
            header={<Subtitle2>Generate a deck</Subtitle2>}
            description={<Caption1>Tip: include audience + goal + time limit for sharper slides.</Caption1>}
          />
          <div className={styles.cardBody}>
            <Field label="Describe your presentation" hint="What is it about, who is it for, and what should they do/learn?">
              <Textarea
                resize="vertical"
                rows={8}
                placeholder="E.g., A quarterly business review showing sales growth, key challenges, and Q2 strategy…"
                value={idea}
                onChange={(e) => setIdea((e.target as HTMLTextAreaElement).value)}
                disabled={isGenerating}
              />
            </Field>

            <div>
              <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>Examples</Caption1>
              <div className={styles.examples}>
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className={`${styles.exampleBtn} ${styles.exampleBtnHover}`}
                    onClick={() => setIdea(ex)}
                    disabled={isGenerating}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.actionsRow}>
              <div className={styles.actionsLeft}>
                <Button appearance="primary" disabled={!idea.trim() || isGenerating} onClick={() => generateDeck(idea)}>
                  {isGenerating ? 'Generating…' : 'Generate Deck'}
                </Button>
                {isGenerating ? <Spinner size="small" /> : null}
              </div>
              <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                {isGenerating ? 'Running agents (outline + visuals + layout)' : 'Stock preferred; AI fallback later'}
              </Caption1>
            </div>

            {error ? <div className={styles.error}>{error}</div> : null}
          </div>
        </Card>
      ) : (
        <div className={styles.wrap}>
          <Card className={styles.contentCard}>
            <CardHeader
              header={<Subtitle2>{deck.title}</Subtitle2>}
              description={<Caption1>{deck.slides.length} slides • pick images per slide, then insert</Caption1>}
            />
            <div className={styles.cardBody}>
              <Button appearance="primary" onClick={insertCurrentDeck} disabled={isGenerating}>
                Insert deck into PowerPoint
              </Button>
            </div>
          </Card>

          {deck.slides.map((s) => (
            <Card key={s.id} className={styles.slideCard}>
              <div className={styles.slideGrid}>
                <Subtitle2>
                  {s.order + 1}. {s.title}
                </Subtitle2>
                <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                  {s.imagePlaceholders?.[0]?.description ?? 'No visual placeholder'}
                </Caption1>

                {/* AI Edit */}
                <Field label="AI edit this slide" hint="Examples: 'make it shorter', 'turn into a quote', 'rewrite for executives'">
                  <Input
                    placeholder="Tell the agent what to change..."
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value;
                        (e.target as HTMLInputElement).value = '';
                        aiEditSlide(s.id, val);
                      }
                    }}
                  />
                </Field>

                <div className={styles.actionsRow}>
                  <div className={styles.actionsLeft}>
                    <Button
                      appearance="secondary"
                      size="small"
                      onClick={() => searchPhotosForSlide(s.id, `${deck.title} ${s.title}`)}
                      disabled={isGenerating}
                    >
                      Search stock photos
                    </Button>
                    {isGenerating ? <Spinner size="tiny" /> : null}
                  </div>
                  <Caption1 style={{ color: tokens.colorNeutralForeground2 }}>
                    Selected: {s.selectedAssets?.some((a) => a.kind === 'photo') ? 'Yes' : 'No'}
                  </Caption1>
                </div>

                {photoResultsBySlideId[s.id]?.length ? (
                  <div className={styles.thumbRow}>
                    {photoResultsBySlideId[s.id].map((r) => (
                      <button
                        key={r.providerId}
                        type="button"
                        onClick={() => selectPhotoForSlide(s.id, r)}
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
          ))}

          {error ? <div className={styles.error}>{error}</div> : null}
        </div>
      )}
    </div>
  );
}
