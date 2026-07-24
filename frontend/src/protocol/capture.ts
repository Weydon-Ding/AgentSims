import type { Uid } from './dtos';

/** T26 replaces this documentation hook with real CDP/Unity trace capture. No real Unity trace exists yet. */
export type NormalizedGoldenFrame = {
  readonly direction: 'sent' | 'received';
  readonly uri: string;
  readonly frame: Readonly<Record<string, unknown>>;
  readonly uid?: Uid;
};

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUid(value: string): value is Uid {
  return /^(Player|Mayor|NPC)-\d+$/.test(value);
}

/**
 * T26 should pass each parsed Unity WebSocket payload here after removing timestamps,
 * connection ids, and other nondeterministic fields, then append the result as JSONL.
 */
export function normalizeCapturedFrame(
  direction: NormalizedGoldenFrame['direction'],
  payload: unknown
): NormalizedGoldenFrame | undefined {
  if (!isRecord(payload) || typeof payload['uri'] !== 'string') return undefined;
  const uid =
    typeof payload['uid'] === 'string' && isUid(payload['uid']) ? payload['uid'] : undefined;
  return { direction, uri: payload['uri'], frame: payload, ...(uid === undefined ? {} : { uid }) };
}
