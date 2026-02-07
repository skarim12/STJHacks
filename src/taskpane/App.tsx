import React, { Suspense, lazy } from "react";
import { Stack, Text, MessageBar, MessageBarType } from "@fluentui/react";
import { useStore } from "./store/useStore";
import { IdeaInputPanel } from "./components/IdeaInputPanel";
import { SlidePreview } from "./components/SlidePreview";
import { ColorThemeSelector } from "./components/ColorThemeSelector";
import { TemplateGallery } from "./components/TemplateGallery";
import { DeckPreviewPanel } from "./components/DeckPreviewPanel";

// Lazy-loaded components (not always needed on initial load)
const ResearchPanel = lazy(() => import("./components/ResearchPanel"));
const NotesGenerator = lazy(() => import("./components/NotesGenerator"));

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
      <DeckPreviewPanel />
      <TemplateGallery />
      <ColorThemeSelector />

      <Suspense fallback={<Text variant="small">Loading research tools…</Text>}>
        <ResearchPanel />
      </Suspense>

      <Suspense fallback={<Text variant="small">Loading notes tools…</Text>}>
        <NotesGenerator />
      </Suspense>
    </Stack>
  );
};

export default App;
