const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const svgToDataUri = (svg: string): string => {
  const encoded = encodeURIComponent(svg)
    .replace(/%0A/g, '')
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
};

export const renderStepsDiagramSvg = (opts: {
  title?: string;
  steps: string[];
  width?: number;
  height?: number;
}): { svg: string; width: number; height: number } => {
  const width = opts.width ?? 1200;
  const height = opts.height ?? 675;

  const padding = 60;
  const boxW = 900;
  const boxH = 70;
  const gap = 18;

  const steps = opts.steps.slice(0, 6);
  const totalH = steps.length * boxH + (steps.length - 1) * gap;
  const startY = Math.max(padding + 60, (height - totalH) / 2);
  const x = (width - boxW) / 2;

  const primary = '#1D74D4';
  const stroke = 'rgba(0,0,0,0.12)';

  const boxes = steps
    .map((t, i) => {
      const y = startY + i * (boxH + gap);
      const arrow =
        i === steps.length - 1
          ? ''
          : `<path d="M ${width / 2} ${y + boxH} L ${width / 2} ${y + boxH + gap}" stroke="${primary}" stroke-width="6" stroke-linecap="round" />`;
      return `
        <rect x="${x}" y="${y}" rx="18" ry="18" width="${boxW}" height="${boxH}" fill="#FFFFFF" stroke="${stroke}" />
        <circle cx="${x + 40}" cy="${y + boxH / 2}" r="16" fill="${primary}" />
        <text x="${x + 40}" y="${y + boxH / 2 + 6}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="18" fill="#fff">${i + 1}</text>
        <text x="${x + 80}" y="${y + boxH / 2 + 8}" font-family="Segoe UI, Arial" font-size="28" fill="#0B2B56">${esc(t)}</text>
        ${arrow}
      `;
    })
    .join('\n');

  const title = opts.title
    ? `<text x="${width / 2}" y="80" text-anchor="middle" font-family="Segoe UI, Arial" font-size="42" fill="#0B2B56">${esc(
        opts.title
      )}</text>`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#F7FBFF"/>
      <stop offset="100%" stop-color="#EEF4FF"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
  ${title}
  ${boxes}
</svg>`;

  return { svg, width, height };
};

export const renderSimpleBarChartSvg = (opts: {
  title?: string;
  labels: string[];
  values: number[];
  unit?: string;
  width?: number;
  height?: number;
}): { svg: string; width: number; height: number } => {
  const width = opts.width ?? 1200;
  const height = opts.height ?? 675;
  const labels = opts.labels.slice(0, 8);
  const values = opts.values.slice(0, labels.length);

  const paddingL = 90;
  const paddingR = 50;
  const paddingT = 110;
  const paddingB = 100;

  const chartW = width - paddingL - paddingR;
  const chartH = height - paddingT - paddingB;

  const max = Math.max(1, ...values);
  const barW = chartW / Math.max(1, values.length);

  const primary = '#1D74D4';
  const grid = 'rgba(0,0,0,0.08)';

  const bars = values
    .map((v, i) => {
      const h = (v / max) * chartH;
      const x = paddingL + i * barW + barW * 0.15;
      const y = paddingT + (chartH - h);
      const w = barW * 0.7;
      const label = esc(labels[i] ?? '');
      return `
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${primary}" opacity="0.9" />
        <text x="${x + w / 2}" y="${paddingT + chartH + 40}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="22" fill="#334">${label}</text>
        <text x="${x + w / 2}" y="${y - 12}" text-anchor="middle" font-family="Segoe UI, Arial" font-size="20" fill="#334">${v}${opts.unit ?? ''}</text>
      `;
    })
    .join('\n');

  const gridLines = [0.25, 0.5, 0.75, 1]
    .map((t) => {
      const y = paddingT + chartH - t * chartH;
      const val = Math.round(t * max);
      return `<line x1="${paddingL}" y1="${y}" x2="${paddingL + chartW}" y2="${y}" stroke="${grid}" stroke-width="2" />
<text x="${paddingL - 16}" y="${y + 8}" text-anchor="end" font-family="Segoe UI, Arial" font-size="20" fill="#667">${val}</text>`;
    })
    .join('\n');

  const title = opts.title
    ? `<text x="${width / 2}" y="70" text-anchor="middle" font-family="Segoe UI, Arial" font-size="42" fill="#0B2B56">${esc(
        opts.title
      )}</text>`
    : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF"/>
  ${title}
  ${gridLines}
  ${bars}
</svg>`;

  return { svg, width, height };
};
