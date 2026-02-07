import React, { useCallback, useState } from "react";
import {
  Stack,
  Text,
  TextField,
  PrimaryButton,
  ProgressIndicator
} from "@fluentui/react";
import { usePresentationStore } from "../state/usePresentationStore";
import { getResearch } from "../services/researchService";

export const ResearchAssistant: React.FC = () => {
  const {
    researchTopic,
    researchResult,
    setResearchTopic,
    setResearchResult,
    setStatus,
    status,
    setErrorMessage
  } = usePresentationStore();

  const [localTopic, setLocalTopic] = useState(researchTopic);

  const isResearching = status === "researching";

  const onResearch = useCallback(async () => {
    if (!localTopic.trim()) {
      setErrorMessage("Enter a topic to research.");
      return;
    }
    setStatus("researching");
    setErrorMessage(null);

    try {
      const result = await getResearch(localTopic.trim());
      setResearchTopic(localTopic.trim());
      setResearchResult(result);
      setStatus("idle");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setErrorMessage(
        err?.response?.data?.error || err.message || "Research failed."
      );
    }
  }, [
    localTopic,
    setErrorMessage,
    setResearchResult,
    setResearchTopic,
    setStatus
  ]);

  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Text variant="mediumPlus">Research Assistant</Text>
      <TextField
        label="Topic or question"
        value={localTopic}
        onChange={(_, v) => setLocalTopic(v ?? "")}
      />
      <PrimaryButton text="Research" onClick={onResearch} disabled={isResearching} />
      {isResearching && (
        <ProgressIndicator label="Researching with AI..." />
      )}
      {researchResult && (
        <Stack tokens={{ childrenGap: 4 }}>
          <Text variant="medium">{researchResult.title}</Text>
          <Text variant="small">{researchResult.summary}</Text>
          {researchResult.bullets?.map((b, i) => (
            <Text key={i} variant="small">
              • {b}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
  );
};