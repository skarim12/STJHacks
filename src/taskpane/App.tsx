import React from "react";
import { Stack, Text, MessageBar, MessageBarType } from "@fluentui/react";
import { useStore } from "./store/useStore";
import { IdeaInputPanel } from "./components/IdeaInputPanel";
import { SlidePreview } from "./components/SlidePreview";
import { ResearchPanel } from "./components/ResearchPanel";
import { ColorThemeSelector } from "./components/ColorThemeSelector";
import { TemplateGallery } from "./components/TemplateGallery";
import { NotesGenerator } from "./components/NotesGenerator";

const App: React.FC = () => {
  const { slides, error, setError } = useStore();

  return (
    <Stack tokens={{ childrenGap: 12, padding: 16 }}>
      <Text variant="xLarge">PowerPoint AI Assistant</Text>
      <Text variant="small">
        Turn rough ideas into structured presentations, preview slides, research topics, adjust colors,
        and generate notes.
      </Text>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}

      <IdeaInputPanel />
      <SlidePreview slides={slides} onEdit={(i) => console.log("Edit slide", i)} />
      <TemplateGallery />
      <ResearchPanel />
      <ColorThemeSelector />
      <NotesGenerator />
    </Stack>
  );
};

export default App;
