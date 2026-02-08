import React from "react";
import { MessageBar, MessageBarType } from "@fluentui/react";

export function StatusBanner(props: {
  outline: any;
  generating: boolean;
  lastSummary?: string | null;
}) {
  const { outline, generating, lastSummary } = props;

  const a = outline ? "Outline ready" : "No outline";
  const b = outline && (outline as any)?.themePrompt ? "Theme set" : "No theme";
  const c = outline && (outline as any)?.decoratePrompt ? "Decorated" : "Not decorated";

  return (
    <MessageBar messageBarType={generating ? MessageBarType.warning : MessageBarType.info}>
      {generating ? "Working…" : "Ready"} • A: {a} • B: {b} • C: {c}
      {lastSummary ? ` • ${String(lastSummary).slice(0, 120)}` : ""}
    </MessageBar>
  );
}
