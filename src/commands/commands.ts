/// <reference types="office-js" />

Office.onReady(() => {
  // Commands entry point; can be extended later if needed
});

export function actionOpenTaskpane(event: Office.AddinCommands.Event) {
  // For ShowTaskpane actions in manifest, Office handles opening.
  event.completed();
}
