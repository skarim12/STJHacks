import React, { useCallback } from "react";
import { Stack, Text, Dropdown, IDropdownOption } from "@fluentui/react";
import { usePresentationStore } from "../state/usePresentationStore";

export const ColorThemeManager: React.FC = () => {
  const { colorTheme, setColorTheme } = usePresentationStore();

  const options: IDropdownOption[] = [
    { key: "Office", text: "Office Default" },
    { key: "Blue", text: "Blue" },
    { key: "Green", text: "Green" },
    { key: "Red", text: "Red" }
  ];

  const onChange = useCallback(
    (
      _e: React.FormEvent<HTMLDivElement>,
      option?: IDropdownOption
    ) => {
      if (!option) return;
      setColorTheme(String(option.key));
    },
    [setColorTheme]
  );

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Text variant="mediumPlus">Color Theme</Text>
      <Dropdown
        options={options}
        selectedKey={colorTheme}
        onChange={onChange}
      />
      <Text variant="small">
        This color is applied to slide titles when inserting content.
      </Text>
    </Stack>
  );
};