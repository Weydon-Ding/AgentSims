import { PUSH_URIS, REQUEST_URI_METADATA, REQUEST_URIS } from '../types';
import type { PushUri, RequestFrame, RequestUri } from '../types';

type UnknownRecord = Readonly<Record<string, unknown>>;
type RequiredDataByUri = Readonly<Record<RequestUri, readonly string[]>>;
export type FrameValidationError =
  | { readonly kind: 'invalid-frame' }
  | { readonly kind: 'missing-uid' }
  | { readonly kind: 'missing-method' }
  | { readonly kind: 'unknown-uri'; readonly uri: string }
  | { readonly kind: 'missing-required-key'; readonly uri: RequestUri; readonly key: string };
export type FrameValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly error: FrameValidationError };
export type CoverageRow = {
  readonly direction: 'request' | 'push';
  readonly uri: string;
  readonly status: 'working' | 'backend-broken' | 'ping' | 'accepted';
};
export type CoverageReport = {
  readonly rows: readonly CoverageRow[];
  readonly missingRequestUris: readonly string[];
  readonly missingPushUris: readonly string[];
};

// Derived from command/* check_params(params, [...]); uid is intentionally top-level.
export const BACKEND_REQUIRED_DATA_KEYS = {
  ping: [],
  'command.auth.Register': ['nickname', 'email', 'cryptoPWD'],
  'command.building.Create': ['building_type', 'name', 'x', 'y', 'rotation'],
  'command.building.GetBuildings': [],
  'command.building.GetBuildingInfo': ['buildingID'],
  'command.npc.Create': [
    'asset',
    'model',
    'memorySystem',
    'planSystem',
    'homeBuilding',
    'workBuilding',
    'nickname',
    'bio',
    'goal',
    'cash',
  ],
  'command.npc.GetNPCs': [],
  'command.npc.GetNPCInfo': ['NPCID'],
  'command.npc.ChangePrompt': ['NPCID', 'promptType', 'promptText'],
  'command.map.Navigate': ['x', 'y'],
  'command.map.GetMapScene': [],
  'command.map.GetMapTown': [],
  'command.chat.ChatWithNPC': ['NPCID', 'content'],
  'command.player.GetPlayerInfo': [],
  'command.mayor.GetInfo': [],
  'command.config.GetBuildingsConfig': [],
  'command.config.GetNPCsConfig': [],
  'command.config.GetEquipmentsConfig': [],
  'command.timetick.Tick': [],
  'command.starter.TickStarter': [],
  'command.starter.MayorStarter': [],
  'command.gm.FakeSendings': ['testName'],
} as const satisfies RequiredDataByUri;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRequestUri(value: string): value is RequestUri {
  return REQUEST_URIS.some((uri) => uri === value);
}

export function validateOutboundFrame(frame: unknown): FrameValidationResult {
  if (!isRecord(frame)) return { ok: false, error: { kind: 'invalid-frame' } };
  if (typeof frame['uid'] !== 'string') return { ok: false, error: { kind: 'missing-uid' } };
  if (!('method' in frame)) return { ok: false, error: { kind: 'missing-method' } };
  if (typeof frame['uri'] !== 'string' || !isRequestUri(frame['uri'])) {
    return {
      ok: false,
      error: { kind: 'unknown-uri', uri: typeof frame['uri'] === 'string' ? frame['uri'] : '' },
    };
  }
  if (!isRecord(frame['data'])) return { ok: false, error: { kind: 'invalid-frame' } };
  for (const key of BACKEND_REQUIRED_DATA_KEYS[frame['uri']]) {
    if (!(key in frame['data']))
      return { ok: false, error: { kind: 'missing-required-key', uri: frame['uri'], key } };
  }
  return { ok: true };
}

export function validateRequestFixtures(
  frames: readonly RequestFrame[]
): readonly FrameValidationResult[] {
  return frames.map(validateOutboundFrame);
}

export function buildCoverageReport(covered: {
  readonly requestUris: readonly string[];
  readonly pushUris: readonly string[];
}): CoverageReport {
  return {
    rows: [
      ...REQUEST_URIS.map((uri) => ({
        direction: 'request' as const,
        uri,
        status:
          uri === 'ping'
            ? ('ping' as const)
            : uri in REQUEST_URI_METADATA
              ? ('backend-broken' as const)
              : ('working' as const),
      })),
      ...PUSH_URIS.map((uri) => ({ direction: 'push' as const, uri, status: 'accepted' as const })),
    ],
    missingRequestUris: REQUEST_URIS.filter((uri) => !covered.requestUris.includes(uri)),
    missingPushUris: PUSH_URIS.filter((uri) => !covered.pushUris.includes(uri)),
  };
}

export function hasExactCoverage(uris: readonly string[], expected: readonly string[]): boolean {
  return (
    uris.length === expected.length &&
    uris.every((uri) => expected.includes(uri)) &&
    expected.every((uri) => uris.includes(uri))
  );
}

export function isRecognizedPushUri(uri: string): uri is PushUri {
  return PUSH_URIS.some((pushUri) => pushUri === uri);
}
