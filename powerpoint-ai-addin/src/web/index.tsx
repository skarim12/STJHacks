import React from 'react';
import { createRoot } from 'react-dom/client';
import { WebApp } from './webApp';

const el = document.getElementById('root');
if (!el) throw new Error('Missing #root');

createRoot(el).render(
  <React.StrictMode>
    <WebApp />
  </React.StrictMode>
);
