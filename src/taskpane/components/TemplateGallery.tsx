import React from "react";
import { Stack, Text, ChoiceGroup, type IChoiceGroupOption } from "@fluentui/react";

const options: IChoiceGroupOption[] = [
  { key: "default", text: "Default Template" },
  { key: "executive", text: "Executive Summary" },
  { key: "detailed", text: "Detailed Analysis" },
];

export const TemplateGallery: React.FC = () => {
  // Placeholder: hook into store when templates affect prompts/layouts
  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Text variant="mediumPlus">Template Gallery</Text>
      <ChoiceGroup options={options} defaultSelectedKey="default" />
    </Stack>
  );
};
