import React, { useMemo, useState } from "react";
import { DefaultButton, MessageBar, MessageBarType, Stack, Text, TextField } from "@fluentui/react";
import { useStore } from "../store/useStore";

export const ThemePanel: React.FC = () => {
  const { outline, generating, applyThemePrompt, lastSummary } = useStore();
  const [themePrompt, setThemePrompt] = useState("");

  const themeChips = useMemo(
    () => [
      "Consulting minimal. Light background, flat panels, blue accent, high contrast.",
      "Startup bold. Dark background, glass panels, neon accent, energetic.",
      "Healthcare calm. Soft gradient, flat panels, teal accent, calm and clean.",
      "Fintech serious. Deep navy background, cyan accent, subtle gradient, high contrast.",
    ],
    []
  );

  const themeStatus = outline
    ? (outline as any)?.themePrompt
      ? `Theme set • motif=${String((outline as any)?.themePlan?.motif || "(none)")}`
      : "No theme applied yet"
    : "Generate an outline first";

  return (
    <Stack tokens={{ childrenGap: 10 }}>
      <Text variant="large">Theme</Text>
      <Text variant="small" styles={{ root: { color: "#666" } }}>
        Creates a deck-wide theme plan (colors + motif + header/panel style) and stores it on the outline.
      </Text>

      <MessageBar messageBarType={outline ? MessageBarType.info : MessageBarType.warning}>
        {themeStatus}
      </MessageBar>

      <TextField
        label="Theme prompt"
        placeholder='Example: "Fintech. Deep navy background, cyan accent, subtle gradient, glass panels. High contrast."'
        value={themePrompt}
        onChange={(_, v) => setThemePrompt(v || "")}
        disabled={generating}
      />

      <Stack horizontal wrap tokens={{ childrenGap: 6 }}>
        {themeChips.map((c) => (
          <DefaultButton
            key={c}
            text={c.split(".")[0]}
            onClick={() => setThemePrompt((p) => (p ? `${p} ${c}` : c))}
            disabled={generating}
          />
        ))}
      </Stack>

      <DefaultButton
        text="Apply Theme"
        disabled={generating || !themePrompt.trim() || !outline}
        onClick={() => applyThemePrompt(themePrompt.trim())}
      />

      {lastSummary && <MessageBar messageBarType={MessageBarType.info}>{lastSummary}</MessageBar>}
    </Stack>
  );
};
