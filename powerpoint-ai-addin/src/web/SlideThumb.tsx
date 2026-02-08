import React from 'react';
import type { Slide } from '../taskpane/types/deck';

const SLIDE_W = 13.333;
const SLIDE_H = 7.5;

export function SlideThumb(props: { slide: Slide; widthPx?: number }) {
  const { slide } = props;
  const pxW = props.widthPx ?? 260;
  const pxH = Math.round((pxW * SLIDE_H) / SLIDE_W);
  const scale = pxW / SLIDE_W;

  const plan = (slide as any).layoutPlan as any | undefined;
  const photoDataUri = slide.selectedAssets?.find((a) => a.kind === 'photo' && a.dataUri)?.dataUri;

  const boxStyle = (b: any): React.CSSProperties => ({
    position: 'absolute',
    left: Math.round(Number(b.x || 0) * scale),
    top: Math.round(Number(b.y || 0) * scale),
    width: Math.round(Number(b.w || 1) * scale),
    height: Math.round(Number(b.h || 1) * scale),
    overflow: 'hidden',
    borderRadius: 10
  });

  const textForKind = (kind: string) => {
    if (kind === 'title') return slide.title || '';
    if (kind === 'subtitle') return (slide as any).subtitle || '';
    if (kind === 'bullets') return (slide.bullets ?? []).map((t) => `• ${t}`).join('\n');
    if (kind === 'body') return slide.bodyText || '';
    return '';
  };

  return (
    <div
      style={{
        width: pxW,
        height: pxH,
        position: 'relative',
        borderRadius: 12,
        border: '1px solid #e5e5e5',
        background: '#fafafa',
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
      }}
    >
      {!plan?.boxes?.length ? (
        <div style={{ padding: 10, fontSize: 12, color: '#666' }}>No layoutPlan</div>
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
                  border: '1px dashed #ddd',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#777',
                  fontSize: 11
                }}
              >
                No image
              </div>
            );
          }

          if (kind === 'shape') {
            const fill = String(b.fill || '').trim();
            return (
              <div
                key={idx}
                style={{
                  ...boxStyle(b),
                  background: fill || 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.06)'
                }}
              />
            );
          }

          const text = textForKind(kind);
          if (!text.trim()) return null;

          const isTitle = kind === 'title';
          return (
            <div key={idx} style={{ ...boxStyle(b), padding: 8 }}>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontSize: isTitle ? 14 : 10.5,
                  lineHeight: isTitle ? '16px' : '13px',
                  color: '#111',
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
}
