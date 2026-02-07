/*
 * scanPostAddin.js
 * - Reads text from the current PowerPoint selection or a task-pane text input
 * - POSTs the text as JSON to http://localhost:8080/process using fetch()
 *
 * Usage:
 * - Include this script in your task pane HTML.
 * - Call `scanAndPostText()` (it returns a Promise resolving to the server response JSON).
 */

/* Ensure Office is ready before using APIs */
if (typeof Office !== 'undefined') {
  Office.onReady().then(() => {
    // no-op for now; exposes function on window below
  });
}

function _getSelectedText() {
  return new Promise((resolve, reject) => {
    if (typeof Office === 'undefined' || !Office.context || !Office.context.document) {
      resolve('');
      return;
    }

    try {
      Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, (asyncResult) => {
        if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
          const text = asyncResult.value || '';
          resolve(String(text));
        } else {
          // Could not get selection (or no text selected)
          resolve('');
        }
      });
    } catch (err) {
      // Fallback to empty string on error
      resolve('');
    }
  });
}

async function _getTaskPaneText() {
  try {
    const el = document.getElementById('taskPaneText');
    if (!el) return '';
    if ('value' in el) return String(el.value || '');
    return String(el.innerText || el.textContent || '');
  } catch (err) {
    return '';
  }
}

async function scanAndPostText() {
  // 1) Try to read selected text in the slide
  let text = await _getSelectedText();

  // 2) If none, try task pane text box with id="taskPaneText"
  if (!text || text.trim() === '') {
    text = await _getTaskPaneText();
  }

  if (!text || text.trim() === '') {
    const msg = 'No text found in selection or task pane.';
    console.warn(msg);
    throw new Error(msg);
  }

  const payload = { text };

  const url = 'http://localhost:8080/process';

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error('Server responded with ' + response.status + ' ' + response.statusText + '\n' + body);
    err.status = response.status;
    throw err;
  }

  // return parsed JSON if present, otherwise return raw text
  const ct = response.headers.get('content-type') || '';
  if (ct.indexOf('application/json') !== -1) {
    return await response.json();
  }
  return await response.text();
}

// Expose function for HTML buttons to call
window.scanAndPostText = scanAndPostText;

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scanAndPostText };
}
