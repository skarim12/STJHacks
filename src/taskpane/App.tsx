import React, { useCallback } from "react";
import {
  Stack,
  Text,
  MessageBar,
  MessageBarType,
  PrimaryButton,
  ProgressIndicator
} from "@fluentui/react";
import { usePresentationStore } from "../state/usePresentationStore";
import { IdeaInputPanel } from "../components/IdeaInputPanel";
import { TemplateSelector } from "../components/TemplateSelector";
import { SlidePreview } from "../components/SlidePreview";
import { ResearchAssistant } from "../components/ResearchAssistant";
import { ColorThemeManager } from "../components/ColorThemeManager";
import { insertSlidesFromOutline } from "../services/powerPointService";

const App: React.FC = () => {
  const {
    slideOutlines,
    refinedPrompt,
    status,
    errorMessage,
    setErrorMessage,
    reset,
    colorTheme
  } = usePresentationStore();

  const isBusy =
    status === "generating" || status === "inserting" || status === "researching";

  const onInsertSlides = useCallback(async () => {
    if (!slideOutlines.length) {
      setErrorMessage("No slide outlines available. Generate them first.");
      return;
    }
    usePresentationStore.setState({ status: "inserting", errorMessage: null });
    try {
      await insertSlidesFromOutline(slideOutlines, colorTheme);
      usePresentationStore.setState({ status: "idle" });
    } catch (err: any) {
      console.error(err);
      usePresentationStore.setState({
        status: "error",
        errorMessage: err.message || "Failed to insert slides."
      });
    }
  }, [colorTheme, setErrorMessage, slideOutlines]);

  const onReset = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <Stack
      tokens={{ childrenGap: 12, padding: 16 }}
      styles={{ root: { minWidth: 340, maxWidth: 520 } }}
    >
      <Text variant="xLarge">PowerPoint AI Assistant</Text>
      <Text variant="small">
        Turn rough ideas into structured presentations with AI, choose templates,
        preview slides, run quick research, and control title colors.
      </Text>

      {errorMessage && (
        <MessageBar
          messageBarType={MessageBarType.error}
          onDismiss={() => setErrorMessage(null)}
        >
          {errorMessage}
        </MessageBar>
      )}

      {isBusy && (
        <ProgressIndicator
          label={
            status === "generating"
              ? "Generating slide outlines..."
              : status === "inserting"
              ? "Inserting slides into PowerPoint..."
              : "Researching..."
          }
        />
      )}

      <IdeaInputPanel />
      <TemplateSelector />

      {refinedPrompt && (
        <Text variant="small">
          <b>Refined Prompt:</b> {refinedPrompt}
        </Text>
      )}

      <SlidePreview />
      <ResearchAssistant />
      <ColorThemeManager />

      <Stack
        horizontal
        tokens={{ childrenGap: 8 }}
        styles={{ root: { marginTop: 8 } }}
      >
        <PrimaryButton
          text="Insert into PowerPoint"
          onClick={onInsertSlides}
          disabled={isBusy || !slideOutlines.length}
        />
        <PrimaryButton text="Reset" onClick={onReset} disabled={isBusy} />
      </Stack>
    </Stack>
  );
};

export default App;