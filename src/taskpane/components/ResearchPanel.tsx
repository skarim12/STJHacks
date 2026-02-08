import React, { useState } from "react";
import { Stack, Text, TextField, PrimaryButton, ProgressIndicator, Dropdown, type IDropdownOption } from "@fluentui/react";
import { useStore } from "../store/useStore";

const ResearchPanel: React.FC = () => {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultText, setResultText] = useState("");
  const [depth, setDepth] = useState<"quick" | "detailed" | "deep">("quick");

  const { researchService, setError } = useStore();

  const depthOptions: IDropdownOption[] = [
    { key: "quick", text: "Quick" },
    { key: "detailed", text: "Detailed" },
    { key: "deep", text: "Deep" },
  ];

  const handleResearch = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setResultText("");
    setError(null);

    try {
      const res: any = await researchService.researchTopic(topic, depth);
      const section = (title: string, arr: any) => {
        const items = Array.isArray(arr) ? arr : [];
        if (!items.length) return "";
        return [title + ":", ...items.map((f: any) => `- ${String(f)}`), ""].join("\n");
      };

      const terms = Array.isArray(res?.terms)
        ? [
            "Terms:",
            ...res.terms.slice(0, 20).map((t: any) => `- ${String(t?.term || "").trim()}: ${String(t?.definition || "").trim()}`),
            "",
          ].join("\n")
        : "";

      const text = [
        section("Key Facts", res.keyFacts),
        section("Recent Developments", res.recentDevelopments),
        section("Expert Perspectives", res.expertPerspectives),
        section("Examples", res.examples),
        section("Data Points", res.dataPoints),
        section("Counterpoints", res.counterpoints),
        terms,
      ]
        .filter(Boolean)
        .join("\n")
        .trim();

      setResultText(text || "(No results)");
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
      <Dropdown
        label="Depth"
        options={depthOptions}
        selectedKey={depth}
        onChange={(_, opt) => setDepth((opt?.key as any) || "quick")}
        disabled={loading}
      />
      <PrimaryButton text={loading ? "Researching…" : "Research"} onClick={handleResearch} disabled={loading} />
      {loading && <ProgressIndicator label="Researching..." />}
      {resultText && <TextField label="Results" multiline rows={14} value={resultText} readOnly />}
    </Stack>
  );
};

export { ResearchPanel };
export default ResearchPanel;
