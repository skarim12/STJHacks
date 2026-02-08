import React, { useState } from "react";
import { Stack, Text, List, TextField, DefaultButton, PrimaryButton, Spinner } from "@fluentui/react";
import { useStore } from "../store/useStore";
import type { SlideStructure } from "../types";

interface Props {
  slides: SlideStructure[];
  onEdit: (index: number) => void;
}

export const SlidePreview: React.FC<Props> = ({ slides, onEdit }) => {
  const { setSlideDescribe, setSlideLook, editSlide, getSlideHtml, decorateSlide, generating } = useStore();
  const [slideHtml, setSlideHtml] = useState<Record<number, string>>({});
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [editMsg, setEditMsg] = useState<Record<number, string>>({});

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
                  <DefaultButton text="Edit JSON" onClick={() => onEdit(index)} />
                  <PrimaryButton
                    text={slideHtml[index] ? "Refresh preview" : "Load preview"}
                    disabled={!!loadingIndex || generating}
                    onClick={async () => {
                      setLoadingIndex(index);
                      try {
                        const html = await getSlideHtml(index);
                        setSlideHtml((m) => ({ ...m, [index]: html }));
                      } finally {
                        setLoadingIndex(null);
                      }
                    }}
                  />
                </Stack>

                {slideHtml[index] && (
                  <div
                    style={{
                      width: "100%",
                      border: "1px solid rgba(0,0,0,.15)",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#111",
                    }}
                  >
                    <div style={{ width: "100%", height: 240, position: "relative" }}>
                      <div
                        style={{
                          transform: "scale(0.22)",
                          transformOrigin: "top left",
                          width: 1920,
                          height: 1080,
                          position: "absolute",
                          left: 0,
                          top: 0,
                        }}
                      >
                        <iframe
                          title={`Slide ${index + 1} preview`}
                          style={{ width: 1920, height: 1080, border: 0, background: "transparent" }}
                          srcDoc={slideHtml[index]}
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {loadingIndex === index && <Spinner label="Rendering slide…" />}

                <TextField
                  label="Describe (optional)"
                  placeholder='Optional. Example: "Use an image of a hospital team collaborating"'
                  value={slide.describe || ""}
                  onChange={(_, v) => setSlideDescribe(index, v || "")}
                />

                <Stack horizontal tokens={{ childrenGap: 10 }} verticalAlign="end" styles={{ root: { flexWrap: "wrap" } }}>
                  <DefaultButton text="Default look" onClick={() => setSlideLook(index, "default")} />
                  <DefaultButton text="Light" onClick={() => setSlideLook(index, "light")} />
                  <DefaultButton text="Dark" onClick={() => setSlideLook(index, "dark")} />
                  <DefaultButton text="Bold" onClick={() => setSlideLook(index, "bold")} />
                </Stack>

                <TextField
                  label="Suggest an edit for this slide"
                  placeholder='E.g., "Make the title shorter and punchier" or "Turn bullets into a 2x2"'
                  value={editMsg[index] || ""}
                  onChange={(_, v) => setEditMsg((m) => ({ ...m, [index]: v || "" }))}
                  disabled={generating}
                />
                <Stack horizontal tokens={{ childrenGap: 8 }}>
                  <PrimaryButton
                    text="Apply slide edit"
                    disabled={generating || !(editMsg[index] || "").trim()}
                    onClick={async () => {
                      const msg = (editMsg[index] || "").trim();
                      if (!msg) return;
                      await editSlide(index, msg);
                      setEditMsg((m) => ({ ...m, [index]: "" }));
                      // refresh preview automatically
                      setLoadingIndex(index);
                      try {
                        const html = await getSlideHtml(index);
                        setSlideHtml((m) => ({ ...m, [index]: html }));
                      } finally {
                        setLoadingIndex(null);
                      }
                    }}
                  />
                  <DefaultButton
                    text="Decorate this slide"
                    disabled={generating}
                    onClick={async () => {
                      await decorateSlide(index, "Improve visuals/typography for this slide only.");
                      setLoadingIndex(index);
                      try {
                        const html = await getSlideHtml(index);
                        setSlideHtml((m) => ({ ...m, [index]: html }));
                      } finally {
                        setLoadingIndex(null);
                      }
                    }}
                  />
                </Stack>
              </Stack>
            ) : null
          }
        />
      )}
    </Stack>
  );
};
