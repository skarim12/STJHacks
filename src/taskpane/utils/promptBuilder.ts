import { UserPreferences } from "../types";

export function buildOutlinePrompt(idea: string, prefs?: UserPreferences): string {
  return `You are a presentation design expert. Create a structured outline for a PowerPoint presentation based on this idea: "${idea}"

${
  prefs
    ? `User preferences:
- Tone: ${prefs.tone}
- Audience: ${prefs.audience}
- Slide count preference: ${prefs.slideCount}
- Include research: ${prefs.includeResearch}`
    : ""
}

Return a JSON structure with:
1. Presentation title
2. Array of slides, each with:
   - title
   - slideType (title/content/comparison/image/quote)
   - content (bullet points or text)
   - notes (speaker notes)
   - suggestedLayout
3. colorScheme with primary, secondary, accent, background, text
4. overallTheme

Keep it concise, professional, and engaging.`;
}
