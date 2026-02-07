import React from "react";
import { Stack, Text, List } from "@fluentui/react";
import type { SlideStructure } from "../types";

interface Props {
  slides: SlideStructure[];
  onEdit: (index: number) => void;
}

export const SlidePreview: React.FC<Props> = ({ slides, onEdit }) => {
  return (
    <Stack tokens={{ childrenGap: 8 }}>
      <Text variant="mediumPlus">Slide Preview</Text>
      {slides.length === 0 ? (
        <Text variant="small">No slides generated yet.</Text>
      ) : (
        <List
          items={slides}
          onRenderCell={(slide, index) =>
            slide && typeof index === "number" ? (
              <Stack
                key={index}
                tokens={{ childrenGap: 2 }}
                style={{
                  border: "1px solid #ddd",
                  padding: 8,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                onClick={() => onEdit(index)}
              >
                <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                  Slide {index + 1}: {slide.title}
                </Text>
                <Text variant="small" styles={{ root: { color: "#666" } }}>
                  Type: {slide.slideType}
                </Text>
              </Stack>
            ) : null
          }
        />
      )}
    </Stack>
  );
};
