import React, { useCallback } from "react";
import { Stack, Text, Dropdown, IDropdownOption } from "@fluentui/react";
import { usePresentationStore } from "../state/usePresentationStore";

export const TemplateSelector: React.FC = () => {
  const { availableTemplates, selectedTemplate, setSelectedTemplate } =
    usePresentationStore();

  const options: IDropdownOption[] = availableTemplates.map((tpl) => ({
    key: tpl.id,
    text: tpl.name
  }));

  const onChange = useCallback(
    (
      _e: React.FormEvent<HTMLDivElement>,
      option?: IDropdownOption
    ) => {
      if (!option) return;
      const tpl = availableTemplates.find((t) => t.id === option.key);
      setSelectedTemplate(tpl ?? null);
    },
    [availableTemplates, setSelectedTemplate]
  );

  const description =
    selectedTemplate?.description || "Choose how structured your slides should be.";

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Text variant="mediumPlus">Template Selector</Text>
      <Dropdown
        options={options}
        placeholder="Select a template"
        selectedKey={selectedTemplate?.id}
        onChange={onChange}
      />
      <Text variant="small">{description}</Text>
    </Stack>
  );
};