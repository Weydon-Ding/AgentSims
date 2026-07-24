import { PUSH_URIS, REQUEST_URIS } from './types';
import type { PushFrame, RequestUri, ResponseEnvelope, Uid } from './types';

export function correlationKey(uid: Uid, uri: RequestUri): string {
  return `${normalizeUid(uid)}\u0000${uri}`;
}

export function isEnvelope(payload: unknown): payload is ResponseEnvelope {
  if (!isRecord(payload) || typeof payload['code'] !== 'number' || typeof payload['msg'] !== 'string') {
    return false;
  }
  return payload['uid'] === undefined || isUid(payload['uid']);
}

export function isPingData(value: unknown): value is { readonly ping: true } {
  return isRecord(value) && value['ping'] === true;
}

export function isPushFrame(envelope: ResponseEnvelope): envelope is ResponseEnvelope & PushFrame {
  return envelope.uri !== undefined && PUSH_URIS.some((uri) => uri === envelope.uri);
}

export function isRequestUri(uri: string | undefined): uri is RequestUri {
  return uri !== undefined && REQUEST_URIS.some((requestUri) => requestUri === uri);
}

function normalizeUid(uid: Uid): string {
  return uid.startsWith('Mayor-') ? `Player-${uid.slice('Mayor-'.length)}` : uid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUid(value: unknown): value is Uid {
  return typeof value === 'string' && /^(Player|Mayor|NPC)-\d+$/.test(value);
}
