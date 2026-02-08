# Theme schema (STJHacks)

## ThemeStyle

```ts
type ThemeMood = "calm" | "energetic" | "serious" | "playful";
type ThemeBackground = "solid" | "subtleGradient";
type ThemePanels = "glass" | "flat";
type ThemeContrast = "auto" | "high";

type ThemeStyle = {
  mood: ThemeMood;
  background: ThemeBackground;
  panels: ThemePanels;
  contrast: ThemeContrast;
};
```

## ColorScheme

```ts
type ColorScheme = {
  primary: string;    // #RRGGBB
  secondary: string;  // #RRGGBB
  accent: string;     // #RRGGBB
  background: string; // #RRGGBB
  text: string;       // #RRGGBB
};
```

## Enforcement rules
- Always normalize to `#rrggbb`.
- Always enforce readable contrast between `background` and `text`.
- If contrast is too low, pick either black-ish `#0b1220` or white `#ffffff` depending on which improves the ratio.
