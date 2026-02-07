import React, { useMemo, useState } from "react";
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Toggle,
  TextField,
} from "@fluentui/react";
import { useStore } from "../store/useStore";

export const DeckPreviewPanel: React.FC = () => {
  const {
    outline,
    aiService,
    externalImagesEnabled,
    setExternalImagesEnabled,
    generatedImagesEnabled,
    setGeneratedImagesEnabled,
    deckDescribe,
    setDeckDescribe,
    deckLook,
    setDeckLook,
  } = useStore();
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [useAi, setUseAi] = useState(true);

  const canRender = !!outline;

  const iframeSrcDoc = useMemo(() => {
    // Keep it self-contained.
    return html;
  }, [html]);

  const openInNewTab = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Note: browser will keep it alive for the tab; revoke later is optional.
    setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
  };

  const render = async () => {
    if (!outline) return;
    setLoading(true);
    setErr(null);
    try {
      const deckHtml = await aiService.getDeckHtml(
        outline,
        useAi,
        externalImagesEnabled,
        generatedImagesEnabled
      );
      if (!deckHtml || deckHtml.length < 50) {
        throw new Error("Deck HTML was empty");
      }
      setHtml(deckHtml);
    } catch (e: any) {
      setErr(e?.message || "Failed to render deck preview");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack tokens={{ childrenGap: 8 }} styles={{ root: { marginTop: 10 } }}>
      <Text variant="large">Slide Viewer</Text>
      <Text variant="small">
        Renders the current outline into the same HTML/CSS used for PDF export, so you can iterate on
        design quickly.
      </Text>

      {err && (
        <MessageBar messageBarType={MessageBarType.error} onDismiss={() => setErr(null)}>
          {err}
        </MessageBar>
      )}

      <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="center" styles={{ root: { flexWrap: "wrap" } }}>
        <PrimaryButton text={loading ? "Rendering…" : "Render Deck"} disabled={!canRender || loading} onClick={render} />
        <DefaultButton text="Open HTML in New Tab" disabled={!html} onClick={openInNewTab} />
        <Toggle
          label="Use AI mode"
          checked={useAi}
          onChange={(_, v) => setUseAi(!!v)}
          inlineLabel
        />
        <Toggle
          label="External images (Wikimedia)"
          checked={externalImagesEnabled}
          onChange={(_, v) => setExternalImagesEnabled(!!v)}
          inlineLabel
        />
        <Toggle
          label="AI-generated images (OpenAI)"
          checked={generatedImagesEnabled}
          onChange={(_, v) => setGeneratedImagesEnabled(!!v)}
          inlineLabel
        />
      </Stack>

      <TextField
        label="Custom describe (applies deck-wide)"
        placeholder='Optional. Example: "Use healthcare imagery, modern minimal style"'
        value={deckDescribe}
        onChange={(_, v) => setDeckDescribe(v || "")}
      />

      <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="end" styles={{ root: { flexWrap: "wrap" } }}>
        <Toggle
          label="Light look"
          checked={deckLook === "light"}
          onChange={(_, v) => setDeckLook(v ? "light" : "default")}
          inlineLabel
        />
        <Toggle
          label="Bold look"
          checked={deckLook === "bold"}
          onChange={(_, v) => setDeckLook(v ? "bold" : "default")}
          inlineLabel
        />
        <Toggle
          label="Dark look"
          checked={deckLook === "dark"}
          onChange={(_, v) => setDeckLook(v ? "dark" : "default")}
          inlineLabel
        />
      </Stack>

      {!outline && (
        <MessageBar messageBarType={MessageBarType.info}>
          Generate or import an outline first, then click “Render Deck”.
        </MessageBar>
      )}

      {html && (
        <div
          style={{
            border: "1px solid rgba(0,0,0,.15)",
            borderRadius: 6,
            overflow: "hidden",
            height: 720,
            width: "100%",
          }}
        >
          <iframe
            title="Deck Preview"
            style={{ width: "100%", height: "100%", border: 0, background: "#111" }}
            srcDoc={iframeSrcDoc}
            sandbox="allow-same-origin"
          />
        </div>
      )}
    </Stack>
  );
};
