import React from "react";
import { Stack, Text, Dropdown, type IDropdownOption } from "@fluentui/react";
import { useStore } from "../store/useStore";

export const ColorThemeSelector: React.FC = () => {
  const { themeService, selectedTheme, setTheme } = useStore();
  const presets = themeService.getPresetSchemes();

  const options: IDropdownOption[] = presets.map((t, idx) => ({
    key: idx,
    text: `Theme ${idx + 1} (${t.primary})`,
  }));

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Text variant="mediumPlus">Color Theme</Text>
      <Dropdown
        options={options}
        selectedKey={presets.findIndex((t) => t.primary === selectedTheme.primary)}
        onChange={(_, opt) => {
          if (typeof opt?.key === "number") setTheme(presets[opt.key]);
        }}
      />
      <Text variant="xSmall" styles={{ root: { color: "#666" } }}>
        Theme primary color: {selectedTheme.primary}
      </Text>
    </Stack>
  );
};
