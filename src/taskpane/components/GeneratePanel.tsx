import React, { useEffect, useState } from "react";
import {
  Stack,
  Text,
  TextField,
  PrimaryButton,
  Dropdown,
  type IDropdownOption,
  Checkbox,
} from "@fluentui/react";
import { useStore } from "../store/useStore";
import type { UserPreferences } from "../types";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export const GeneratePanel: React.FC = () => {
  const [idea, setIdea] = useState("");
  const debouncedIdea = useDebouncedValue(idea, 400);

  const [prefs, setPrefs] = useState<UserPreferences>({
    tone: "formal",
    audience: "General audience",
    slideCount: "medium",
    includeResearch: false,
  });

  const {
    outline,
    generating,
    generateFromIdea,
    powerPointService,
    selectedTheme,
    smartSelectTemplate,
  } = useStore();

  const w = window as any;
  const isPowerPointHost = !!w.PowerPoint && typeof w.PowerPoint.run === "function";

  useEffect(() => {
    if (debouncedIdea.trim()) {
      smartSelectTemplate(debouncedIdea).catch(() => undefined);
    }
  }, [debouncedIdea, smartSelectTemplate]);

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
    if (!debouncedIdea.trim()) return;

    await generateFromIdea(debouncedIdea, prefs);

    // Optional: if running inside PowerPoint, insert slides immediately.
    if (isPowerPointHost) {
      const latestOutline = useStore.getState().outline;
      if (!latestOutline) return;
      await powerPointService.createSlidesBatch(latestOutline.slides);
      await powerPointService.applyColorTheme(selectedTheme);
    }
  };

  return (
    <Stack tokens={{ childrenGap: 10 }}>
      <Text variant="large">Generate</Text>
      <Text variant="small" styles={{ root: { color: "#666" } }}>
        Start from a rough idea. We’ll generate an outline, then you can theme + decorate.
      </Text>

      <TextField
        label="Presentation idea"
        multiline
        rows={5}
        placeholder='E.g., "A quarterly business review showing sales growth, key challenges, and Q2 strategy"'
        value={idea}
        onChange={(_, v) => setIdea(v || "")}
        disabled={generating}
      />

      <Stack tokens={{ childrenGap: 8 }}>
        <Dropdown
          label="Tone"
          options={toneOptions}
          selectedKey={prefs.tone}
          onChange={(_, opt) => setPrefs((p) => ({ ...p, tone: opt?.key as UserPreferences["tone"] }))}
          disabled={generating}
        />

        <Dropdown
          label="Slide count"
          options={slideCountOptions}
          selectedKey={prefs.slideCount}
          onChange={(_, opt) =>
            setPrefs((p) => ({ ...p, slideCount: opt?.key as UserPreferences["slideCount"] }))
          }
          disabled={generating}
        />

        <TextField
          label="Audience"
          value={prefs.audience}
          onChange={(_, v) => setPrefs((p) => ({ ...p, audience: v || "" }))}
          disabled={generating}
        />

        <Checkbox
          label="Include additional research"
          checked={prefs.includeResearch}
          onChange={(_, checked) => setPrefs((p) => ({ ...p, includeResearch: !!checked }))}
          disabled={generating}
        />
      </Stack>

      <PrimaryButton
        text={outline ? "Regenerate" : "Generate"}
        onClick={handleGenerate}
        disabled={!debouncedIdea.trim() || generating}
        iconProps={{ iconName: "Lightbulb" }}
      />
    </Stack>
  );
};
