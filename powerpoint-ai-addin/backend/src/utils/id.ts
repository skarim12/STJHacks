export const newId = (prefix: string): string => {
  // Node 18+ has crypto.randomUUID
  const uuid = (globalThis as any)?.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
};
