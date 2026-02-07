/// <reference types="office-js" />

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

function render() {
  const container = document.getElementById("root");
  if (!container) throw new Error("Root element #root not found.");

  const root = createRoot(container);
  root.render(<App />);
}

/**
 * Why this exists:
 * - When you open taskpane.html in a normal browser tab, Office.js loads but Office.onReady()
 *   may never fire (because you're not actually inside an Office host).
 * - That can look like a "blank page" even though your React bundle is fine.
 */
(function boot() {
  const w = window as any;

  // In a plain browser, just render immediately.
  if (!w.Office || typeof w.Office.onReady !== "function") {
    render();
    return;
  }

  // In Office, prefer Office.onReady. Also set a fallback timeout so we never stay blank forever.
  let rendered = false;
  const tryRender = () => {
    if (rendered) return;
    rendered = true;
    render();
  };

  w.Office.onReady()
    .then(tryRender)
    .catch((err: any) => {
      // eslint-disable-next-line no-console
      console.error("Office.onReady failed; rendering anyway", err);
      tryRender();
    });

  // If Office.onReady never resolves (common when opened in a browser), render after 1s.
  setTimeout(tryRender, 1000);
})();
