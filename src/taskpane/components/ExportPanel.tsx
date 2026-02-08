import React, { useState } from "react";
import {
  DefaultButton,
  MessageBar,
  MessageBarType,
  Stack,
  Text,
  TextField,
} from "@fluentui/react";
import { useStore } from "../store/useStore";

export const ExportPanel: React.FC = () => {
  const {
    outline,
    extractedText,
    generating,
    editFromMessage,
    exportPptx,
    exportPdf,
    importPptx,
    downloadOutlineJson,
    downloadExtractedText,
    importedFileName,
  } = useStore();

  const [editMessage, setEditMessage] = useState("");

  const handleApplyEditMessage = async () => {
    if (!editMessage.trim()) return;
    await editFromMessage(editMessage.trim());
  };

  return (
    <Stack tokens={{ childrenGap: 10 }}>
      <Text variant="large">Export & Edit</Text>
      <Text variant="small" styles={{ root: { color: "#666" } }}>
        Apply a global edit instruction, export files, or import an existing .pptx.
      </Text>

      {!outline && (
        <MessageBar messageBarType={MessageBarType.info}>
          Generate or import an outline first.
        </MessageBar>
      )}

      <TextField
        label="Edit instruction"
        placeholder='E.g., "Make this more persuasive for investors" or "Tighten every slide to max 4 bullets"'
        value={editMessage}
        onChange={(_, v) => setEditMessage(v || "")}
        disabled={generating}
      />

      <Stack horizontal tokens={{ childrenGap: 8 }} styles={{ root: { flexWrap: "wrap" } }}>
        <DefaultButton
          text="Apply Edit"
          onClick={handleApplyEditMessage}
          disabled={generating || !editMessage.trim() || !outline}
        />
        <DefaultButton text="Download .pptx" onClick={exportPptx} disabled={generating || !outline} />
        <DefaultButton text="Download .pdf" onClick={exportPdf} disabled={generating || !outline} />
        <DefaultButton
          text="Download outline (.json)"
          onClick={downloadOutlineJson}
          disabled={generating || !outline}
        />
        <DefaultButton
          text="Download extracted text (.txt)"
          onClick={downloadExtractedText}
          disabled={generating || !extractedText}
        />
        <label style={{ display: "inline-block" }}>
          <input
            type="file"
            accept=".pptx"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importPptx(f);
              e.currentTarget.value = "";
            }}
          />
          <DefaultButton
            text={importedFileName ? `Upload .pptx (current: ${importedFileName})` : "Upload .pptx"}
            disabled={generating}
          />
        </label>
      </Stack>
    </Stack>
  );
};
