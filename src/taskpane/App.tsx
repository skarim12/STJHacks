import React, { Suspense, lazy } from "react";
import {
  Stack,
  Text,
  MessageBar,
  MessageBarType,
  Pivot,
  PivotItem,
  Separator,
  ProgressIndicator,
} from "@fluentui/react";
import { useStore } from "./store/useStore";
import { GeneratePanel } from "./components/GeneratePanel";
import { ThemePanel } from "./components/ThemePanel";
import { DecoratePanel } from "./components/DecoratePanel";
import { ExportPanel } from "./components/ExportPanel";
import { SlidePreview } from "./components/SlidePreview";
import { ColorThemeSelector } from "./components/ColorThemeSelector";
import { TemplateGallery } from "./components/TemplateGallery";
import { DeckPreviewPanel } from "./components/DeckPreviewPanel";
import { StatusBanner } from "./components/StatusBanner";

// Lazy-loaded components (not always needed on initial load)
const ResearchPanel = lazy(() => import("./components/ResearchPanel"));
const NotesGenerator = lazy(() => import("./components/NotesGenerator"));

const App: React.FC = () => {
  const { outline, slides, error, setError, generating, lastSummary } = useStore();

  return (
    <Stack tokens={{ childrenGap: 10 }} styles={{ root: { padding: 14 } }}>
      <Stack tokens={{ childrenGap: 6 }}>
        <Text variant="xLarge">Slide AI</Text>
        <Text variant="small" styles={{ root: { color: "#666" } }}>
          Generate → Theme → Decorate → Preview → Export
        </Text>
      </Stack>

      {error && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setError(null)}>
          {error}
        </MessageBar>
      )}

      <StatusBanner outline={outline} generating={generating} lastSummary={lastSummary} />

      {generating && <ProgressIndicator label="Working…" />}

      <Separator />

      <Pivot>
        <PivotItem headerText="Generate">
          <GeneratePanel />
        </PivotItem>

        <PivotItem headerText="Theme">
          <ThemePanel />
        </PivotItem>

        <PivotItem headerText="Decorate">
          <DecoratePanel />
        </PivotItem>

        <PivotItem headerText="Slides">
          <SlidePreview slides={slides} onEdit={(i) => console.log("Edit slide", i)} />
        </PivotItem>

        <PivotItem headerText="Preview">
          <DeckPreviewPanel />
        </PivotItem>

        <PivotItem headerText="Templates">
          <TemplateGallery />
        </PivotItem>

        <PivotItem headerText="Colors">
          <ColorThemeSelector />
        </PivotItem>

        <PivotItem headerText="Research">
          <Suspense fallback={<Text variant="small">Loading research tools…</Text>}>
            <ResearchPanel />
          </Suspense>
        </PivotItem>

        <PivotItem headerText="Notes">
          <Suspense fallback={<Text variant="small">Loading notes tools…</Text>}>
            <NotesGenerator />
          </Suspense>
        </PivotItem>

        <PivotItem headerText="Export">
          <ExportPanel />
        </PivotItem>
      </Pivot>
    </Stack>
  );
};

export default App;
