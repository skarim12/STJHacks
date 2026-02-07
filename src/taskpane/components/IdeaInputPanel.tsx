import React, { useState } from "react";
import {
  TextField,
  PrimaryButton,
  Stack,
  ProgressIndicator,
  Dropdown,
  type IDropdownOption,
  Checkbox,
} from "@fluentui/react";
import { useStore } from "../store/useStore";
import type { UserPreferences } from "../types";

export const IdeaInputPanel: React.FC = () => {
  const [idea, setIdea] = useState("");
  const [prefs, setPrefs] = useState<UserPreferences>({
    tone: "formal",
    audience: "General audience",
    slideCount: "medium",
    includeResearch: false,
  });

  const { generateFromIdea, generating, powerPointService, outline, selectedTheme } = useStore();

  const toneOptions: IDropdownOption[] = [
    { key: "formal", text: "Formal" },
    { key: "casual", text: "Casual" },
    { key: "technical", text: "Technical" },
    { key: "inspirational", text: "Inspirational" },
  ];

  const slideCountOptions: IDropdownOption[] = [
    { key: "short", text: "Short (5–8 slides)" },
    { key: "medium", text: "Medium (9–15 slides)" },
    { key: "long", text: "Long (16+ slides)" },
  ];

  const handleGenerate = async () => {
    if (!idea.trim()) return;

    await generateFromIdea(idea, prefs);

    // NOTE: outline is stateful; read latest from store after generate.
    const latestOutline = useStore.getState().outline;
    if (!latestOutline) return;

    for (const slide of latestOutline.slides) {
      await powerPointService.createSlideFromStructure(slide);
    }

    await powerPointService.applyColorTheme(selectedTheme);
  };

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <TextField
        label="Describe your presentation idea"
        multiline
        rows={4}
        placeholder='E.g., A quarterly business review showing our sales growth, key challenges, and Q2 strategy...'
        value={idea}
        onChange={(_, v) => setIdea(v || "")}
        disabled={generating}
      />

      <Dropdown
        label="Tone"
        options={toneOptions}
        selectedKey={prefs.tone}
        onChange={(_, opt) =>
          setPrefs((p) => ({ ...p, tone: opt?.key as UserPreferences["tone"] }))
        }
      />

      <Dropdown
        label="Slide count"
        options={slideCountOptions}
        selectedKey={prefs.slideCount}
        onChange={(_, opt) =>
          setPrefs((p) => ({ ...p, slideCount: opt?.key as UserPreferences["slideCount"] }))
        }
      />

      <TextField
        label="Audience"
        value={prefs.audience}
        onChange={(_, v) => setPrefs((p) => ({ ...p, audience: v || "" }))}
      />

      <Checkbox
        label="Include additional research"
        checked={prefs.includeResearch}
        onChange={(_, checked) => setPrefs((p) => ({ ...p, includeResearch: !!checked }))}
      />

      <PrimaryButton
        text="Generate Presentation"
        onClick={handleGenerate}
        disabled={!idea || generating}
        iconProps={{ iconName: "Lightbulb" }}
      />

      {generating && (
        <ProgressIndicator
          label="Creating your presentation..."
          description="AI is generating slides and content"
        />
      )}
    </Stack>
  );
};
