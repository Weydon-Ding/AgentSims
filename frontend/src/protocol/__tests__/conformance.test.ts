import { beforeEach, describe, expect, it } from 'vitest';

import { useChatStore } from '../../stores/chat-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useEntityStore } from '../../stores/entity-store';
import { useLogStore } from '../../stores/log-store';
import { useSimStore } from '../../stores/sim-store';
import { dispatchIncomingPush } from '../push-handlers';
import { isDispatchablePush } from '../push-guards';
import { PUSH_URIS, REQUEST_URIS } from '../types';
import { WsClient, type WebSocketLike } from '../ws-client';
import {
  BACKEND_REQUIRED_DATA_KEYS,
  buildCoverageReport,
  hasExactCoverage,
  isRecognizedPushUri,
  validateOutboundFrame,
  validateRequestFixtures,
} from './conformance';
import { PUSH_FIXTURES, REQUEST_FIXTURES } from './conformance-fixtures';

type Listener = (event: Event) => void;

class ReplaySocket implements WebSocketLike {
  readonly readyState = 1;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, new Set([...(this.listeners.get(type) ?? []), listener]));
  }
  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.listeners.get('close')?.forEach((listener) => listener(new Event('close')));
  }
  open(): void {
    this.listeners.get('open')?.forEach((listener) => listener(new Event('open')));
  }
  respond(frame: unknown): void {
    this.listeners
      .get('message')
      ?.forEach((listener) =>
        listener(new MessageEvent('message', { data: JSON.stringify(frame) }))
      );
  }
}

function resetStores(): void {
  useEntityStore.getState().reset();
  useChatStore.getState().reset();
  useSimStore.getState().reset();
  useLogStore.getState().reset();
  useConnectionStore.getState().reset();
}

describe('protocol conformance harness', () => {
  beforeEach(resetStores);

  it('Given all request fixtures, When validating backend requirements, Then every URI has an exact frame and required data keys', async () => {
    const socket = new ReplaySocket();
    const client = new WsClient({ webSocketFactory: () => socket, pingIntervalMs: 60_000 });
    client.connect('ws://conformance.test/ws');
    socket.open();
    const validations = validateRequestFixtures(REQUEST_FIXTURES);
    expect(validations).toEqual(REQUEST_FIXTURES.map(() => ({ ok: true })));
    expect(
      hasExactCoverage(
        REQUEST_FIXTURES.map((frame) => frame.uri),
        REQUEST_URIS
      )
    ).toBe(true);
    for (const frame of REQUEST_FIXTURES) {
      const pending = client.send(frame);
      expect(JSON.parse(socket.sent.at(-1) ?? '')).toEqual(frame);
      socket.respond({
        code: 200,
        uid: frame.uid,
        uri: frame.uri,
        msg: '',
        data: frame.uri === 'ping' ? { ping: true } : {},
      });
      await pending;
    }
    client.dispose();
  });

  it('Given every typed push fixture, When replayed through the boundary, Then all are accepted, dispatched, and never logged as malformed', () => {
    expect(
      hasExactCoverage(
        PUSH_FIXTURES.map((frame) => frame.uri),
        PUSH_URIS
      )
    ).toBe(true);
    for (const frame of PUSH_FIXTURES) {
      resetStores();
      expect(isRecognizedPushUri(frame.uri)).toBe(true);
      expect(isDispatchablePush(frame)).toBe(true);
      expect(() => dispatchIncomingPush(frame)).not.toThrow();
      expect(useLogStore.getState().entries.some((entry) => entry.kind === 'unknown-push')).toBe(
        false
      );
      if (frame.uri === 'movePath') {
        expect(useEntityStore.getState().paths['NPC-3']).toEqual([{ x: 1, y: 2 }]);
      }
      if (frame.uri === 'mayor.npc.Create') {
        expect(useEntityStore.getState().npcs['NPC-3']).toMatchObject({
          name: 'Bob',
          cash: 10,
          home_building: 1,
        });
      }
    }
  });

  it('Given a malformed known movePath push, When replayed, Then the guard rejects it and the boundary records an unknown-push', () => {
    const malformed: unknown = { code: 200, uri: 'movePath', data: {} };
    expect(isDispatchablePush(malformed)).toBe(false);
    dispatchIncomingPush(malformed);
    expect(useLogStore.getState().entries).toEqual([
      { kind: 'unknown-push', message: 'Malformed push frame' },
    ]);
  });

  it('Given the protocol coverage report, When inspected, Then it explicitly lists 20 working requests, one broken request, ping, and 15 pushes', () => {
    const report = buildCoverageReport({
      requestUris: REQUEST_FIXTURES.map((frame) => frame.uri),
      pushUris: PUSH_FIXTURES.map((frame) => frame.uri),
    });
    const requests = report.rows.filter((row) => row.direction === 'request');
    const pushes = report.rows.filter((row) => row.direction === 'push');
    expect(
      hasExactCoverage(
        requests.map((row) => row.uri),
        REQUEST_URIS
      )
    ).toBe(true);
    expect(
      hasExactCoverage(
        pushes.map((row) => row.uri),
        PUSH_URIS
      )
    ).toBe(true);
    expect(requests.filter((row) => row.status === 'working')).toHaveLength(20);
    expect(requests.filter((row) => row.status === 'backend-broken')).toEqual([
      { direction: 'request', uri: 'command.npc.ChangePrompt', status: 'backend-broken' },
    ]);
    expect(requests.find((row) => row.uri === 'ping')).toEqual({
      direction: 'request',
      uri: 'ping',
      status: 'ping',
    });
    expect(pushes).toHaveLength(15);
    expect(report.missingRequestUris).toEqual([]);
    expect(report.missingPushUris).toEqual([]);
    expect(
      REQUEST_FIXTURES.find((frame) => frame.uri === 'command.chat.ChatWithNPC')?.data
    ).toEqual({ NPCID: 'NPC-3', content: 'hello' });
    expect(REQUEST_FIXTURES.find((frame) => frame.uri === 'command.npc.GetNPCInfo')?.data).toEqual({
      NPCID: 3,
    });
    expect(
      REQUEST_FIXTURES.find((frame) => frame.uri === 'command.building.GetBuildingInfo')?.data
    ).toEqual({ buildingID: 9 });
    expect(BACKEND_REQUIRED_DATA_KEYS['command.chat.ChatWithNPC']).toEqual(['NPCID', 'content']);
  });

  it('Given an unknown frame missing method, When the validator sees it, Then dispatch precondition failure is explicit', () => {
    const malformed: unknown = {
      uid: 'Player-7',
      uri: 'command.map.Navigate',
      data: { x: 1, y: 2 },
    };
    expect(validateOutboundFrame(malformed)).toEqual({
      ok: false,
      error: { kind: 'missing-method' },
    });
  });

  it('Given an unknown ChangePrompt frame missing promptText, When validated, Then it fails for that real backend-required key', () => {
    const malformed: unknown = {
      uid: 'Player-7',
      uri: 'command.npc.ChangePrompt',
      method: null,
      data: { NPCID: 3, promptType: 'plan' },
    };
    expect(validateOutboundFrame(malformed)).toEqual({
      ok: false,
      error: { kind: 'missing-required-key', uri: 'command.npc.ChangePrompt', key: 'promptText' },
    });
  });
});
