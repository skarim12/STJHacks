export type StageName =
  | 'outline'
  | 'visual_intent'
  | 'assets'
  | 'style'
  | 'layout'
  | 'qa'
  | 'done'
  | 'generate';

export type Reporter = {
  stageStart?: (stage: StageName, meta?: any) => void;
  artifact?: (stage: StageName, name: string, data: any) => void;
  warning?: (stage: StageName, message: string, data?: any) => void;
  stageEnd?: (stage: StageName, meta?: any) => void;
};

export function safeReporter(r?: Reporter): Required<Reporter> {
  return {
    stageStart: (stage, meta) => {
      try {
        r?.stageStart?.(stage, meta);
      } catch {
        // ignore
      }
    },
    artifact: (stage, name, data) => {
      try {
        r?.artifact?.(stage, name, data);
      } catch {
        // ignore
      }
    },
    warning: (stage, message, data) => {
      try {
        r?.warning?.(stage, message, data);
      } catch {
        // ignore
      }
    },
    stageEnd: (stage, meta) => {
      try {
        r?.stageEnd?.(stage, meta);
      } catch {
        // ignore
      }
    }
  };
}
