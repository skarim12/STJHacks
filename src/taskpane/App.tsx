import React, { useCallback, useState } from "react";
import { Stack, Text, TextField, PrimaryButton, DefaultButton, MessageBar, MessageBarType, ProgressIndicator } from "@fluentui/react";
import { usePresentationStore } from "../state/usePresentationStore";
import { generateSlideOutlines } from "../api/anthropicClient";
import { insertSlidesFromOutline } from "../office/powerpoint";

const App: React.FC = () => {
  const {
    roughIdea,
    refinedPrompt,
    slideOutlines,
    status,
    errorMessage,
    setRoughIdea,
    setRefinedPrompt,
    setSlideOutlines,
    setStatus,
    setErrorMessage,
    reset
  } = usePresentationStore();

  const [localIdea, setLocalIdea] = useState(roughIdea);

  const onGenerate = useCallback(async () => {
    if (!localIdea.trim()) {
      setErrorMessage("Please enter a rough idea for your presentation.");
      return;
    }

    setErrorMessage(null);
    setStatus("generating");

    try {
      const result = await generateSlideOutlines(localIdea.trim());
      setRefinedPrompt(result.refinedPrompt ?? "");
      setSlideOutlines(result.slides);
      setRoughIdea(localIdea.trim());
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to generate slides."
      );
    }
  }, [
    localIdea,
    setErrorMessage,
    setStatus,
    setRefinedPrompt,
    setSlideOutlines,
    setRoughIdea
  ]);

  const onInsertSlides = useCallback(async () => {
    if (!slideOutlines.length) {
      setErrorMessage("No slide outlines available. Generate them first.");
      return;
    }

    setErrorMessage(null);
    setStatus("inserting");

    try {
      await insertSlidesFromOutline(slideOutlines);
      setStatus("idle");
    } catch (error) {
      console.error(error);
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to insert slides into PowerPoint."
      );
    }
  }, [slideOutlines, setErrorMessage, setStatus]);

  const onReset = useCallback(() => {
    reset();
    setLocalIdea("");
  }, [reset]);

  const isBusy = status === "generating" || status === "inserting";

  return (
    <Stack
      tokens={{ childrenGap: 12, padding: 16 }}
      styles={{ root: { minWidth: 320, maxWidth: 480 } }}
    >
      <Text variant="xLarge">PowerPoint AI Assistant</Text>
      <Text variant="small">
        Paste a rough idea for your presentation. The AI will generate a
        structured slide outline and insert it into your deck.
      </Text>

      {errorMessage && (
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setErrorMessage(null)}
        >
          {errorMessage}
        </MessageBar>
      )}

      {(status === "generating" || status === "inserting") && (
        <ProgressIndicator
          label={
            status === "generating"
              ? "Generating slide outlines with AI..."
              : "Inserting slides into PowerPoint..."
          }
        />
      )}

      <TextField
        label="Rough idea"
        multiline
        rows={6}
        value={localIdea}
        onChange={(_, newValue) => setLocalIdea(newValue ?? "")}
        disabled={isBusy}
      />

      {refinedPrompt && (
        <TextField
          label="Refined AI prompt (read-only)"
          multiline
          rows={3}
          value={refinedPrompt}
          readOnly
        />
      )}

      {slideOutlines.length > 0 && (
        <Stack tokens={{ childrenGap: 6 }}>
          <Text variant="mediumPlus">Preview of slide outline</Text>
          <Stack
            styles={{
              root: {
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid #ddd",
                padding: 8
              }
            }}
            tokens={{ childrenGap: 4 }}
          >
            {slideOutlines.map((slide, index) => (
              <Stack key={index} tokens={{ childrenGap: 2 }}>
                <Text variant="medium">
                  {index + 1}. {slide.title}
                </Text>
                {slide.bulletPoints?.map((bp, i) => (
                  <Text key={i} variant="small">
                    • {bp}
                  </Text>
                ))}
              </Stack>
            ))}
          </Stack>
        </Stack>
      )}

      <Stack
        horizontal
        tokens={{ childrenGap: 8 }}
        styles={{ root: { marginTop: 8 } }}
      >
        <PrimaryButton
          text="Generate Outline"
          onClick={onGenerate}
          disabled={isBusy}
        />
        <PrimaryButton
          text="Insert into PowerPoint"
          onClick={onInsertSlides}
          disabled={isBusy || !slideOutlines.length}
        />
        <DefaultButton text="Reset" onClick={onReset} disabled={isBusy} />
      </Stack>

      <Text variant="xSmall" styles={{ root: { marginTop: 16, opacity: 0.6 } }}>
        Note: Ensure your Anthropic API key is configured before using the AI
        features.
      </Text>
    </Stack>
  );
};

export default App;