import React, { useState } from "react";
import {
  Stack,
  Text,
  Dropdown,
  type IDropdownOption,
  TextField,
  PrimaryButton,
} from "@fluentui/react";
import { useStore } from "../store/useStore";

export const ColorThemeSelector: React.FC = () => {
  const { themeService, selectedTheme, setTheme, generateThemeFromDescribe } = useStore();
  const presets = themeService.getPresetSchemes();
  const [describe, setDescribe] = useState("");

  const options: IDropdownOption[] = presets.map((t, idx) => ({
    key: idx,
    text: `Theme ${idx + 1} (${t.primary})`,
  }));

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Text variant="mediumPlus">Color Theme</Text>
      <Dropdown
        options={options}
        selectedKey={presets.findIndex((t) => t.primary === selectedTheme.primary)}
        onChange={(_, opt) => {
          if (typeof opt?.key === "number") setTheme(presets[opt.key]);
        }}
      />

      <TextField
        label="AI theme (describe the look)"
        placeholder='Example: "modern biotech, clean, cool blues, high contrast"'
        value={describe}
        onChange={(_, v) => setDescribe(v || "")}
      />
      <PrimaryButton
        text="Generate custom theme"
        disabled={!describe.trim()}
        onClick={() => generateThemeFromDescribe(describe.trim())}
      />

      <Text variant="xSmall" styles={{ root: { color: "#666" } }}>
        Current: primary {selectedTheme.primary}, bg {selectedTheme.background}, text {selectedTheme.text}
      </Text>
    </Stack>
  );
};
