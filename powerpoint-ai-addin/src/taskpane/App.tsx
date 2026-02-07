import React from 'react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { IdeaInputPanel } from './components/IdeaInputPanel';

export function App() {
  return (
    <FluentProvider theme={webLightTheme}>
      <IdeaInputPanel />
    </FluentProvider>
  );
}
