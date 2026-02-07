import React from "react";
import { List, Text, Stack } from "@fluentui/react";
import type { SlideStructure } from "../types";

interface SlidePreviewProps {
  slides: SlideStructure[];
  onEdit: (index: number) => void;
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({ slides, onEdit }) => {
  return (
    <Stack tokens={{ childrenGap: 10 }} styles={{ root: { padding: 16 } }}>
      <Text variant="large">Slide Preview</Text>

      <List
        items={slides}
        onRenderCell={(slide, index) =>
          slide && typeof index === "number" ? (
            <Stack
              key={index}
              style={{
                border: "1px solid #ddd",
                padding: 8,
                borderRadius: 4,
                cursor: "pointer"
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
    </Stack>
  );
};
