import type { SlideOutline } from "../state/usePresentationStore";

export async function insertSlidesFromOutline(slides: SlideOutline[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    Office.onReady(async (info) => {
      if (info.host !== Office.HostType.PowerPoint) {
        reject(new Error("This add-in only works in PowerPoint."));
        return;
      }

      try {
        // In the new PowerPoint API (Office Scripts-style), you’d use `PowerPoint.run`.
        // Here we use the common Office.js API exposed via `Office.context.document`.
        const context = (Office.context as any);
        const doc = context.document;

        // Simple approach: build HTML string and insert.
        // For more advanced control, use PowerPoint-specific APIs when available.
        let html = "";

        slides.forEach((slide, index) => {
          const title = slide.title || `Slide ${index + 1}`;
          const bullets =
            slide.bulletPoints && slide.bulletPoints.length
              ? "<ul>" +
                slide.bulletPoints
                  .map((b) => `<li>${escapeHtml(b)}</li>`)
                  .join("") +
                "</ul>"
              : "";

          html += `<h1>${escapeHtml(title)}</h1>${bullets}<br/><br/>`;
        });

        doc.setSelectedDataAsync(
          html,
          {
            coercionType: Office.CoercionType.Html
          },
          (asyncResult: Office.AsyncResult<void>) => {
            if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
              resolve();
            } else {
              reject(
                asyncResult.error ||
                  new Error("Failed to insert slides into PowerPoint.")
              );
            }
          }
        );
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}