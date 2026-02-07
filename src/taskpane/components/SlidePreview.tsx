import React from "react";
import { Stack, Text, List, TextField, DefaultButton } from "@fluentui/react";
import { useStore } from "../store/useStore";
import type { SlideStructure } from "../types";

interface Props {
  slides: SlideStructure[];
  onEdit: (index: number) => void;
}

export const SlidePreview: React.FC<Props> = ({ slides, onEdit }) => {
  const { setSlideDescribe } = useStore();

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
                tokens={{ childrenGap: 8 }}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  borderRadius: 6,
                }}
              >
                <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 10 }}>
                  <Stack tokens={{ childrenGap: 2 }} styles={{ root: { flex: 1 } }}>
                    <Text variant="medium" styles={{ root: { fontWeight: 600 } }}>
                      Slide {index + 1}: {slide.title}
                    </Text>
                    <Text variant="small" styles={{ root: { color: "#666" } }}>
                      Type: {slide.slideType}
                    </Text>
                  </Stack>
                  <DefaultButton text="Edit" onClick={() => onEdit(index)} />
                </Stack>

                <TextField
                  label="Describe (optional)"
                  placeholder='Optional. Example: "Use an image of a hospital team collaborating"'
                  value={slide.describe || ""}
                  onChange={(_, v) => setSlideDescribe(index, v || "")}
                />
              </Stack>
            ) : null
          }
        />
      )}
    </Stack>
  );
};
