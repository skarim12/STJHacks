import React, { useState } from 'react';
import { Button, Field, Textarea, Spinner } from '@fluentui/react-components';
import { useStore } from '../store/useStore';

export function IdeaInputPanel() {
  const [idea, setIdea] = useState('');
  const { generateFromIdea, status, error } = useStore();

  const isGenerating = status === 'generating';

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <Field label="Describe your presentation idea">
        <Textarea
          resize="vertical"
          rows={8}
          placeholder='E.g., A quarterly business review showing our sales growth, key challenges, and Q2 strategy...'
          value={idea}
          onChange={(e) => setIdea((e.target as HTMLTextAreaElement).value)}
          disabled={isGenerating}
        />
      </Field>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Button
          appearance="primary"
          disabled={!idea.trim() || isGenerating}
          onClick={() => generateFromIdea(idea)}
        >
          Generate Presentation
        </Button>
        {isGenerating ? <Spinner size="small" /> : null}
      </div>

      {error ? (
        <div style={{ color: '#b10e1e' }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
