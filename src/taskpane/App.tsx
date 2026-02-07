import React, { useCallback } from "react";
import { Stack, Text } from "@fluentui/react";
import { IdeaInputPanel } from "../components/IdeaInputPanel";
import { SlidePreview } from "../components/SlidePreview";
import { useStore } from "../store/useStore";

const App: React.FC = () => {
  const { slides } = useStore();

  const handleEdit = useCallback((index: number) => {
    // For now just log; you can open a slide editor dialog here.
    // eslint-disable-next-line no-console
    console.log("Edit slide", index);
  }, []);

  return (
    <Stack tokens={{ childrenGap: 12, padding: 16 }}>
      <Text variant="xLarge">PowerPoint AI Assistant</Text>
      <Text variant="small">
        Turn rough ideas into structured slides, preview them, and insert directly into
        PowerPoint.
      </Text>

      <IdeaInputPanel />
      <SlidePreview slides={slides} onEdit={handleEdit} />
    </Stack>
  );
};

export default App;