import { ColorScheme } from "../types";

export class ThemeService {
  getDefaultScheme(): ColorScheme {
    return {
      primary: "#0078D4",
      secondary: "#2B88D8",
      accent: "#FFB900",
      background: "#FFFFFF",
      text: "#000000"
    };
  }

  getPresetSchemes(): ColorScheme[] {
    return [
      this.getDefaultScheme(),
      {
        primary: "#107C10",
        secondary: "#3A9A3A",
        accent: "#FFB900",
        background: "#FFFFFF",
        text: "#000000"
      },
      {
        primary: "#D13438",
        secondary: "#E81123",
        accent: "#FF8C00",
        background: "#FFFFFF",
        text: "#000000"
      }
    ];
  }
}