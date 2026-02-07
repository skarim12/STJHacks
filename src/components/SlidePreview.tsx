import React from "react";
import { Stack, Text } from "@fluentui/react";
import { usePresentationStore } from "../state/usePresentationStore";

export const SlidePreview: React.FC = () => {
  const { slideOutlines } = usePresentationStore();

  return (
    <Stack tokens={{ childrenGap: 6 }}>
      <Text variant="mediumPlus">Slide Preview</Text>
      {slideOutlines.length === 0 ? (
        <Text variant="small">No slides generated yet.</Text>
      ) : (
        <Stack
          styles={{
            root: {
              maxHeight: 220,
              overflowY: "auto",
              border: "1px solid #ddd",
              padding: 8
            }
          }}
          tokens={{ childrenGap: 6 }}
        >
          {slideOutlines.map((slide, index) => (
            <Stack key={index} tokens={{ childrenGap: 2 }}>
              <Text variant="medium">
                {index + 1}. {slide.title}
              </Text>
              {slide.bulletPoints?.map((bp, i) => (
                <Text key={i} variant="small">
                  • {bp}
                </Text>
              ))}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};