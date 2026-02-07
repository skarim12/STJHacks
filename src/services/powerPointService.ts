import type { SlideOutline } from "../state/usePresentationStore";

export async function insertSlidesFromOutline(
  slides: SlideOutline[],
  colorTheme: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    Office.onReady((info) => {
      if (info.host !== Office.HostType.PowerPoint) {
        reject(new Error("This add-in only works in PowerPoint."));
        return;
      }

      try {
        const context = Office.context as any;
        const doc = context.document;

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

          const colorStyle =
            colorTheme && colorTheme !== "Office"
              ? ` style="color:${getThemeColor(colorTheme)}"`
              : "";

          html += `<h1${colorStyle}>${escapeHtml(title)}</h1>${bullets}<br/><br/>`;
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

function getThemeColor(theme: string): string {
  switch (theme) {
    case "Blue":
      return "#0078D4";
    case "Green":
      return "#107C10";
    case "Red":
      return "#D13438";
    default:
      return "#000000";
  }
}