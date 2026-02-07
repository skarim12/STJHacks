import React, { useState } from "react";
import { Stack, Text, TextField, PrimaryButton, ProgressIndicator } from "@fluentui/react";
import { useStore } from "../store/useStore";

export const ResearchPanel: React.FC = () => {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState("");

  const { researchService, setError } = useStore();

  const handleResearch = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResultText("");
    setError(null);

    try {
      const res = await researchService.researchTopic(topic, "quick");
      const text = [
        "Key Facts:",
        ...res.keyFacts.map((f) => `- ${f}`),
        "",
        "Recent Developments:",
        ...res.recentDevelopments.map((f) => `- ${f}`),
        "",
        "Expert Perspectives:",
        ...res.expertPerspectives.map((f) => `- ${f}`),
        "",
        "Examples:",
        ...res.examples.map((f) => `- ${f}`),
      ].join("\n");
      setResultText(text);
    } catch (err: any) {
      setError(err?.message || "Research failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Text variant="mediumPlus">Research Assistant</Text>
      <TextField label="Topic" value={topic} onChange={(_, v) => setTopic(v || "")} />
      <PrimaryButton text="Research" onClick={handleResearch} disabled={loading} />
      {loading && <ProgressIndicator label="Researching..." />}
      {resultText && <TextField label="Results" multiline rows={8} value={resultText} readOnly />}
    </Stack>
  );
};
