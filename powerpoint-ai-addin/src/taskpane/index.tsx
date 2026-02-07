import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('container');
if (!container) {
  throw new Error('Missing #container element');
}

createRoot(container).render(<App />);
