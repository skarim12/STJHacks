import React, { useState } from "react";
import { Stack, Text, PrimaryButton, ProgressIndicator, TextField } from "@fluentui/react";
import { useStore } from "../store/useStore";

export const NotesGenerator: React.FC = () => {
  const { slides, aiService, powerPointService, setError } = useStore();
  const [loading, setLoading] = useState(false);
  const [exportedNotes, setExportedNotes] = useState("");

  const handleGenerateNotes = async () => {
    if (!slides.length) return;
    setLoading(true);
    setError(null);

    try {
      // Optionally regenerate notes via AI, then export all
      for (let i = 0; i < slides.length; i++) {
        const notes = await aiService.generateSpeakerNotes(slides[i]);
        slides[i].notes = notes;
      }
      const all = await powerPointService.exportToNotes();
      setExportedNotes(all);
    } catch (err: any) {
      setError(err?.message || "Failed to generate notes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Text variant="mediumPlus">Speaker Notes</Text>
      <PrimaryButton
        text="Generate & Export Notes"
        onClick={handleGenerateNotes}
        disabled={loading || !slides.length}
      />
      {loading && <ProgressIndicator label="Generating notes..." />}
      {exportedNotes && (
        <TextField label="Exported Notes" value={exportedNotes} multiline rows={8} readOnly />
      )}
    </Stack>
  );
};
