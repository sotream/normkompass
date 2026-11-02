import type { ModelOutput } from './types.js';

/** Parses the model's JSON output; returns null if it does not have the expected shape. */
export function parseModelOutput(raw: string): ModelOutput | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { refused, answer, citations } = value as Record<string, unknown>;
  if (typeof refused !== 'boolean' || typeof answer !== 'string' || !Array.isArray(citations)) {
    return null;
  }
  const parsed: ModelOutput['citations'] = [];
  for (const c of citations as unknown[]) {
    if (typeof c !== 'object' || c === null) return null;
    const { chunk, quote } = c as Record<string, unknown>;
    if (typeof chunk !== 'number' || !Number.isInteger(chunk) || typeof quote !== 'string') {
      return null;
    }
    // Any other field of a citation (for example a path or URL of the model's own) is dropped here.
    parsed.push({ chunk, quote });
  }
  return { refused, answer, citations: parsed };
}
