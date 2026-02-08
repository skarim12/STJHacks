import React, { useEffect, useState } from "react";
import {
  Text,
  TextField,
  PrimaryButton,
  DefaultButton,
  Stack,
  ProgressIndicator,
  Dropdown,
  type IDropdownOption,
  Checkbox,
  MessageBar,
  MessageBarType,
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

export const IdeaInputPanel: React.FC = () => {
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
    generateFromIdea,
    applyThemePrompt,
    decorateDeck,
    editFromMessage,
    exportPptx,
    exportPdf,
    importPptx,
    downloadOutlineJson,
    downloadExtractedText,
    generating,
    powerPointService,
    selectedTheme,
    smartSelectTemplate,
    importedFileName,
    extractedText,
    lastEnrichment,
    setLastEnrichment,
    lastSummary,
  } = useStore();

  const [editMessage, setEditMessage] = useState("");
  const [themePrompt, setThemePrompt] = useState("");
  const [decoratePrompt, setDecoratePrompt] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const themeChips = [
    "Consulting minimal. Light background, flat panels, blue accent, high contrast.",
    "Startup bold. Dark background, glass panels, neon accent, energetic.",
    "Healthcare calm. Soft gradient, flat panels, teal accent, calm and clean.",
    "Fintech serious. Deep navy background, cyan accent, subtle gradient, high contrast.",
  ];

  const decorateChips = [
    "Increase layout variety (more grids/stacks/callouts).",
    "Make typography more editorial: lead bullet bold, tighter spacing.",
    "Add subtle motif shapes (ribbons / corner frames) and keep them consistent.",
    "Add relevant imagery for every slide with an image slot; prefer professional photo style.",
    "Add sections and labeling for structure.",
  ];

  const w = window as any;
  const isOfficeHost = !!w.Office && typeof w.Office.onReady === "function";
  const isPowerPointHost = !!w.PowerPoint && typeof w.PowerPoint.run === "function";

  useEffect(() => {
    if (debouncedIdea.trim()) {
      // Suggest template based on debounced idea (non-blocking)
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

    setLastEnrichment(null);
    await generateFromIdea(debouncedIdea, prefs);

    // If running inside PowerPoint, also insert slides.
    if (isPowerPointHost) {
      const latestOutline = useStore.getState().outline;
      if (!latestOutline) return;

      // Batch insert slides to reduce PowerPoint.run/context.sync overhead
      await powerPointService.createSlidesBatch(latestOutline.slides);
      await powerPointService.applyColorTheme(selectedTheme);
    }
  };

  const handleApplyEditMessage = async () => {
    if (!editMessage.trim()) return;
    await editFromMessage(editMessage.trim());
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

      <Text variant="mediumPlus">Workflow</Text>
      <Text variant="small" styles={{ root: { color: "#666" } }}>
        Step A: Generate content → Step B: Theme → Step C: Decorate → Step D: Export PPTX.
      </Text>
      <MessageBar messageBarType={MessageBarType.info}>
        A: {outline ? "Outline ready" : "Not generated"} | B: {(outline as any)?.themePrompt ? "Theme set" : "No theme"} | C: {(outline as any)?.decoratePrompt ? "Decorated" : "Not decorated"}
      </MessageBar>

      <PrimaryButton
        text={outline ? "Regenerate Presentation" : "Generate Presentation"}
        onClick={handleGenerate}
        disabled={!debouncedIdea || generating}
        iconProps={{ iconName: "Lightbulb" }}
      />

      <TextField
        label="Theme prompt (background, shapes, mood)"
        placeholder='Example: "Fintech. Deep navy background, cyan accent, subtle gradient, glass panels. High contrast."'
        value={themePrompt}
        onChange={(_, v) => setThemePrompt(v || "")}
        disabled={generating}
      />
      <Stack horizontal wrap tokens={{ childrenGap: 6 }}>
        {themeChips.map((c) => (
          <DefaultButton key={c} text={c.split(".")[0]} onClick={() => setThemePrompt((p) => (p ? `${p} ${c}` : c))} />
        ))}
      </Stack>
      <DefaultButton
        text="Apply Theme"
        disabled={generating || !themePrompt.trim() || !outline}
        onClick={() => applyThemePrompt(themePrompt.trim())}
      />

      <TextField
        label="Decorate prompt (images + polish)"
        placeholder='Example: "Increase layout variety. Add subtle motif shapes. Add relevant imagery for slides with image slots."'
        value={decoratePrompt}
        onChange={(_, v) => setDecoratePrompt(v || "")}
        disabled={generating}
      />
      <Stack horizontal wrap tokens={{ childrenGap: 6 }}>
        {decorateChips.map((c) => (
          <DefaultButton key={c} text={c.slice(0, 22) + (c.length > 22 ? "…" : "")} onClick={() => setDecoratePrompt((p) => (p ? `${p} ${c}` : c))} />
        ))}
      </Stack>
      <DefaultButton
        text="Decorate Deck"
        disabled={generating || !decoratePrompt.trim() || !outline}
        onClick={() => decorateDeck(decoratePrompt.trim())}
      />

      {lastSummary && (
        <MessageBar messageBarType={MessageBarType.info}>{lastSummary}</MessageBar>
      )}

      {lastEnrichment && (
        <MessageBar
          messageBarType={
            lastEnrichment?.imagesAfter > 0 ? MessageBarType.success : MessageBarType.warning
          }
        >
          {lastEnrichment?.imagesAfter > 0
            ? `Images ready: ${lastEnrichment.imagesAfter} (added ${lastEnrichment.imagesAdded}).`
            : `Images: none. First error: ${String(
                lastEnrichment?.perSlide?.find((p: any) => p?.error)?.error || "(none)"
              ).slice(0, 240)}`}
        </MessageBar>
      )}

      <DefaultButton
        text={showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
        disabled={!outline}
        onClick={() => setShowDiagnostics((s) => !s)}
      />

      {showDiagnostics && outline && (
        <TextField
          label="Diagnostics"
          multiline
          rows={10}
          value={JSON.stringify(
            {
              look: (outline as any)?.look,
              themeStyle: (outline as any)?.themeStyle,
              colorScheme: (outline as any)?.colorScheme,
              lastEnrichment,
            },
            null,
            2
          )}
          readOnly
        />
      )}

      <Stack tokens={{ childrenGap: 8 }}>
        <TextField
          label="Edit instruction (message)"
          placeholder='E.g., "Make this more persuasive for investors" or "Add a slide about risks"'
          value={editMessage}
          onChange={(_, v) => setEditMessage(v || "")}
          disabled={generating}
        />
        <Stack horizontal tokens={{ childrenGap: 8 }}>
          <DefaultButton
            text="Apply Edit"
            onClick={handleApplyEditMessage}
            disabled={generating || !editMessage.trim()}
          />
          <DefaultButton text="Download .pptx" onClick={exportPptx} disabled={generating} />
          <DefaultButton text="Download .pdf" onClick={exportPdf} disabled={generating} />
          <DefaultButton text="Download outline (.json)" onClick={downloadOutlineJson} disabled={generating} />
          <DefaultButton
            text="Download extracted text (.txt)"
            onClick={downloadExtractedText}
            disabled={generating || !extractedText}
          />
          <label style={{ display: "inline-block" }}>
            <input
              type="file"
              accept=".pptx"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importPptx(f);
                // allow re-uploading same file
                e.currentTarget.value = "";
              }}
            />
            <DefaultButton text={importedFileName ? `Upload .pptx (current: ${importedFileName})` : "Upload .pptx"} disabled={generating} />
          </label>
        </Stack>
      </Stack>

      {generating && (
        <ProgressIndicator
          label="Working..."
          description="Generating, editing, or exporting"
        />
      )}
    </Stack>
  );
};
