import React, { useMemo, useState } from "react";
import {
  DefaultButton,
  MessageBar,
  MessageBarType,
  Stack,
  Text,
  TextField,
  Toggle,
} from "@fluentui/react";
import { useStore } from "../store/useStore";

export const DecoratePanel: React.FC = () => {
  const {
    outline,
    generating,
    decorateDeck,
    externalImagesEnabled,
    setExternalImagesEnabled,
    generatedImagesEnabled,
    setGeneratedImagesEnabled,
    lastEnrichment,
    lastSummary,
  } = useStore();

  const [decoratePrompt, setDecoratePrompt] = useState("");

  const decorateChips = useMemo(
    () => [
      "Increase layout variety (more grids/stacks/callouts).",
      "Make typography more editorial: lead bullet bold, tighter spacing.",
      "Add subtle motif shapes (ribbons / corner frames) and keep them consistent.",
      "Add relevant imagery for every slide with an image slot; prefer professional photo style.",
      "Add sections and labeling for structure.",
      "Add dividers for each section.",
    ],
    []
  );

  return (
    <Stack tokens={{ childrenGap: 10 }}>
      <Text variant="large">Decorate</Text>
      <Text variant="small" styles={{ root: { color: "#666" } }}>
        Picks layout variants, fills reserved image slots, and adds style polish. Guarantees: no blank placeholders.
      </Text>

      <Stack horizontal tokens={{ childrenGap: 10 }} styles={{ root: { flexWrap: "wrap" } }}>
        <Toggle
          label="External images (Wikimedia)"
          checked={externalImagesEnabled}
          onChange={(_, v) => setExternalImagesEnabled(!!v)}
          inlineLabel
        />
        <Toggle
          label="AI-generated fallback images (OpenAI)"
          checked={generatedImagesEnabled}
          onChange={(_, v) => setGeneratedImagesEnabled(!!v)}
          inlineLabel
        />
      </Stack>

      <TextField
        label="Decorate prompt"
        placeholder='Example: "Increase layout variety. Add subtle motif shapes. Add relevant imagery for slides with image slots."'
        value={decoratePrompt}
        onChange={(_, v) => setDecoratePrompt(v || "")}
        disabled={generating}
      />

      <Stack horizontal wrap tokens={{ childrenGap: 6 }}>
        {decorateChips.map((c) => (
          <DefaultButton
            key={c}
            text={c.slice(0, 28) + (c.length > 28 ? "…" : "")}
            onClick={() => setDecoratePrompt((p) => (p ? `${p} ${c}` : c))}
            disabled={generating}
          />
        ))}
      </Stack>

      <DefaultButton
        text="Decorate Deck"
        disabled={generating || !decoratePrompt.trim() || !outline}
        onClick={() => decorateDeck(decoratePrompt.trim())}
      />

      {lastSummary && <MessageBar messageBarType={MessageBarType.info}>{lastSummary}</MessageBar>}

      {lastEnrichment && (
        <MessageBar
          messageBarType={lastEnrichment?.imagesAfter > 0 ? MessageBarType.success : MessageBarType.warning}
        >
          {lastEnrichment?.imagesAfter > 0
            ? `Images ready: ${lastEnrichment.imagesAfter} (added ${lastEnrichment.imagesAdded}).`
            : `Images: none. First error: ${String(
                lastEnrichment?.perSlide?.find((p: any) => p?.error)?.error || "(none)"
              ).slice(0, 240)}`}
        </MessageBar>
      )}
    </Stack>
  );
};
