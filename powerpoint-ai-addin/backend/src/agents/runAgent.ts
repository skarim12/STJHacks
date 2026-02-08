import { z } from 'zod';

export type AgentRunResult<T> = {
  ok: true;
  value: T;
  warnings?: string[];
} | {
  ok: false;
  error: string;
  issues?: unknown;
};

/**
 * OpenClaw-style agent wrapper:
 * - runs a function that returns unknown JSON
 * - validates against a Zod schema
 * - (later) can retry with feedback
 */
export const runAgent = async <T>(opts: {
  name: string;
  schema: z.ZodType<T>;
  run: () => Promise<unknown>;
}): Promise<AgentRunResult<T>> => {
  try {
    const raw = await opts.run();
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Agent ${opts.name} produced invalid output`,
        issues: parsed.error.issues
      };
    }
    return { ok: true, value: parsed.data };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
};
