import React, { useState, useCallback } from "react";
import { Stack, Text, TextField, PrimaryButton } from "@fluentui/react";
import { usePresentationStore } from "../state/usePresentationStore";
import { generateSlideOutlines } from "../services/aiService";

export const IdeaInputPanel: React.FC = () => {
  const {
    roughIdea,
    setRoughIdea,
    setRefinedPrompt,
    setSlideOutlines,
    setStatus,
    setErrorMessage
  } = usePresentationStore();

  const [localIdea, setLocalIdea] = useState(roughIdea);

  const onGenerate = useCallback(async () => {
    if (!localIdea.trim()) {
      setErrorMessage("Please enter a rough idea for your presentation.");
      return;
    }
    setStatus("generating");
    setErrorMessage(null);

    try {
      const result = await generateSlideOutlines(localIdea.trim());
      setRoughIdea(localIdea.trim());
      setRefinedPrompt(result.refinedPrompt ?? "");
      setSlideOutlines(result.slides);
      setStatus("idle");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(err?.response?.data?.error || err.message || "Generation failed.");
    }
  }, [
    localIdea,
    setErrorMessage,
    setRoughIdea,
    setRefinedPrompt,
    setSlideOutlines,
    setStatus
  ]);

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Text variant="mediumPlus">Idea Input</Text>
      <TextField
        label="Rough idea"
        multiline
        rows={5}
        value={localIdea}
        onChange={(_, v) => setLocalIdea(v ?? "")}
      />
      <PrimaryButton text="Generate Outline" onClick={onGenerate} />
    </Stack>
  );
};