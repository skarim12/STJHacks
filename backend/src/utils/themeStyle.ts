export type ThemeMood = "calm" | "energetic" | "serious" | "playful";
export type ThemeBackground = "solid" | "subtleGradient";
export type ThemePanels = "glass" | "flat";
export type ThemeContrast = "auto" | "high";

export type ThemeStyle = {
  mood: ThemeMood;
  background: ThemeBackground;
  panels: ThemePanels;
  contrast: ThemeContrast;
};

function normHex(h: any, fallback: string): string {
  const s = String(h || "").trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  const x = m[1];
  return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16) };
}

function relLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(a: string, b: string): number {
  const L1 = relLuminance(a);
  const L2 = relLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function defaultThemeStyle(outline: any): ThemeStyle {
  const look = String(outline?.look || "default").toLowerCase();
  const mood: ThemeMood = look === "bold" ? "energetic" : look === "dark" ? "serious" : "calm";

  return {
    mood,
    background: look === "bold" ? "subtleGradient" : "solid",
    panels: look === "light" ? "flat" : "glass",
    contrast: "auto",
  };
}

export function enforceThemeStyle(outline: any): any {
  if (!outline || typeof outline !== "object") return outline;

  // Attach themeStyle if missing or partial.
  const t0 = outline.themeStyle && typeof outline.themeStyle === "object" ? outline.themeStyle : {};
  const d = defaultThemeStyle(outline);
  const themeStyle: ThemeStyle = {
    mood: (t0.mood === "calm" || t0.mood === "energetic" || t0.mood === "serious" || t0.mood === "playful") ? t0.mood : d.mood,
    background: (t0.background === "solid" || t0.background === "subtleGradient") ? t0.background : d.background,
    panels: (t0.panels === "glass" || t0.panels === "flat") ? t0.panels : d.panels,
    contrast: (t0.contrast === "auto" || t0.contrast === "high") ? t0.contrast : d.contrast,
  };

  outline.themeStyle = themeStyle;

  // Enforce color scheme normalization + minimum contrast.
  outline.colorScheme = outline.colorScheme && typeof outline.colorScheme === "object" ? outline.colorScheme : {};

  const bg = normHex(outline.colorScheme.background, "#0b1220");
  let text = normHex(outline.colorScheme.text, "#ffffff");

  const ratio = contrastRatio(bg, text);
  const target = themeStyle.contrast === "high" ? 7.0 : 4.5;
  if (ratio < target) {
    // Pick whichever of black/white is better.
    const black = "#0b1220";
    const white = "#ffffff";
    text = contrastRatio(bg, white) >= contrastRatio(bg, black) ? white : black;
  }

  outline.colorScheme.background = bg;
  outline.colorScheme.text = text;
  outline.colorScheme.accent = normHex(outline.colorScheme.accent || outline.colorScheme.primary, "#6ee7ff");
  outline.colorScheme.secondary = normHex(outline.colorScheme.secondary, "#a78bfa");

  return outline;
}
