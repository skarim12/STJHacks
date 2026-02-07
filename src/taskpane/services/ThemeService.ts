import type { ColorScheme } from "../types";
import { AIService } from "./AIService";

export class ThemeService {
  constructor(private aiService: AIService) {}

  getDefaultScheme(): ColorScheme {
    return {
      primary: "#0078D4",
      secondary: "#2B88D8",
      accent: "#FFB900",
      background: "#FFFFFF",
      text: "#000000",
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
        text: "#000000",
      },
      {
        primary: "#D13438",
        secondary: "#E81123",
        accent: "#FF8C00",
        background: "#FFFFFF",
        text: "#000000",
      },
    ];
  }

  async generateThemeFromContext(
    industry: string,
    mood: "professional" | "creative" | "energetic"
  ): Promise<ColorScheme> {
    try {
      return await this.aiService.generateColorSchemeFromContext(industry, mood);
    } catch {
      return this.getDefaultScheme();
    }
  }

  async generateThemeFromDescribe(describe: string): Promise<ColorScheme> {
    try {
      return await this.aiService.generateThemeFromDescribe(describe);
    } catch {
      return this.getDefaultScheme();
    }
  }

  async applyBrandColors(brandColors: string[]): Promise<ColorScheme> {
    const [primary, secondary, accent] = brandColors;

    return {
      primary: primary || "#0078D4",
      secondary: secondary || "#2B88D8",
      accent: accent || "#FFB900",
      background: "#FFFFFF",
      text: "#000000",
    };
  }
}
