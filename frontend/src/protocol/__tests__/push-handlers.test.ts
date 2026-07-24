import { beforeEach, describe, expect, it } from 'vitest';

import { dispatchIncomingPush, dispatchPush } from '../push-handlers';
import { useChatStore } from '../../stores/chat-store';
import { useConnectionStore } from '../../stores/connection-store';
import { useEntityStore } from '../../stores/entity-store';
import { useLogStore } from '../../stores/log-store';
import { useSimStore } from '../../stores/sim-store';

describe('推送处理器', () => {
  beforeEach(() => {
    useEntityStore.getState().reset();
    useChatStore.getState().reset();
    useSimStore.getState().reset();
    useLogStore.getState().reset();
    useConnectionStore.getState().reset();
  });

  it('Given 15 个协议推送 When 分发 Then 每个推送更新对应状态切片', () => {
    dispatchPush({ code: 200, uri: 'welcome', uid: 'Player-1' });
    dispatchPush({
      code: 200,
      uri: 'mayor.npc.Create',
      data: npcFixture,
    });
    dispatchPush({ code: 200, uri: 'mayor.building.Create', data: buildingFixture });
    dispatchPush({
      code: 200,
      uri: 'movePath',
      data: { uid: 'NPC-2', path: [{ x: 1, y: 2 }] },
    });
    dispatchPush({
      code: 200,
      uri: 'moveTo',
      data: { uid: 'NPC-2', fromX: 1, fromY: 2, toX: 3, toY: 4 },
    });
    dispatchPush({ code: 200, uri: 'NPC-React', data: { uid: 'NPC-2', reaction: 'notice' } });
    dispatchPush({ code: 200, uri: 'newPlan', data: { uid: 'NPC-2', plan: 'work' } });
    dispatchPush({
      code: 200,
      uri: 'planToMove',
      data: { uid: 'NPC-2', targetBuilding: 'Cafe', targetBuildingID: 7 },
    });
    dispatchPush({
      code: 200,
      uri: 'chatWith',
      data: { sourceID: 'Player-1', targetID: 'NPC-2', content: 'hello' },
    });
    dispatchPush({
      code: 200,
      uri: 'interact',
      data: {
        uid: 'NPC-2',
        equipment: 3,
        operation: 'read',
        continueTime: 8,
        cost: 2,
        earn: 5,
      },
    });
    dispatchPush({ code: 200, uri: 'newAction', data: { uid: 'NPC-2', action: 'read' } });
    expect(useSimStore.getState().actions['NPC-2']).toEqual({ uid: 'NPC-2', action: 'read' });
    dispatchPush({
      code: 200,
      uri: 'finishAction',
      data: { uid: 'NPC-2', action: 'read', startTime: 1, endTime: 9 },
    });
    dispatchPush({
      code: 200,
      uri: 'changeCash',
      data: { uid: 'NPC-2', cash: 103, amount: 3, effect: 'increase' },
    });
    dispatchPush({
      code: 200,
      uri: 'changeRevenue',
      data: { uid: 'Player-1', revenue: 17, amount: 7, effect: 'increase' },
    });
    dispatchPush({
      code: 200,
      uri: 'increaseBuildingIncome',
      data: { uid: 'Player-1', building_id: 7, income: 12, amount: 2 },
    });

    const entities = useEntityStore.getState();
    const simulation = useSimStore.getState();
    expect(useConnectionStore.getState().uid).toBe('Player-1');
    expect(entities.positions['NPC-2']).toEqual({ x: 3, y: 4 });
    expect(entities.paths['NPC-2']).toEqual([{ x: 1, y: 2 }]);
    expect(entities.npcs['NPC-2']).toMatchObject({
      name: 'Ada',
      cash: 103,
      plan: 'work',
      x: 3,
      y: 4,
      asset: 'adult',
      memorySystem: 'memory',
      home_building: 1,
      work_building: null,
    });
    expect(entities.npcs['NPC-0']).toBeUndefined();
    expect(entities.players['Player-1']).toMatchObject({ revenue: 17 });
    expect(entities.buildings[7]).toMatchObject({ id: 7, rI: 12 });
    expect(simulation.targetBuilding).toEqual({ uid: 'NPC-2', id: 7, name: 'Cafe' });
    expect(simulation.interactions['NPC-2']).toMatchObject({ equipment: 3, operation: 'read' });
    expect(simulation.actions['NPC-2']).toMatchObject({ action: 'read', endTime: 9 });
    expect(useChatStore.getState().messages).toEqual([
      { content: 'hello', speaker: 'Player-1', speakerID: 'Player-1', targetID: 'NPC-2' },
    ]);
    expect(useLogStore.getState().entries).toContainEqual(
      expect.objectContaining({ kind: 'npc-reaction', uid: 'NPC-2' })
    );
  });

  it('Given chat 历史载荷 When 分发 chatWith Then 替换聊天记录', () => {
    dispatchPush({
      code: 200,
      uri: 'chatWith',
      data: { chats: [{ content: 'older', speaker: 'Ada', speakerID: 'NPC-2' }] },
    });

    expect(useChatStore.getState().messages).toEqual([
      { content: 'older', speaker: 'Ada', speakerID: 'NPC-2' },
    ]);
  });

  it('Given 未知或畸形推送 When 安全分发 Then 写入日志且不抛出', () => {
    expect(() => dispatchIncomingPush({ code: 200, uri: 'future.push', data: {} })).not.toThrow();
    expect(() => dispatchIncomingPush(null)).not.toThrow();
    expect(() => dispatchIncomingPush({ code: 200, uri: 'movePath', data: null })).not.toThrow();
    expect(() => dispatchIncomingPush({ code: 200, uri: 'movePath', data: {} })).not.toThrow();

    expect(useLogStore.getState().entries).toEqual([
      expect.objectContaining({ kind: 'unknown-push', message: 'Unknown push URI: future.push' }),
      expect.objectContaining({ kind: 'unknown-push', message: 'Malformed push frame' }),
      expect.objectContaining({ kind: 'unknown-push', message: 'Malformed push frame' }),
      expect.objectContaining({ kind: 'unknown-push', message: 'Malformed push frame' }),
    ]);
    expect(useEntityStore.getState().paths).not.toHaveProperty('undefined');
  });
});

const npcFixture = {
  uid: 'NPC-2',
  homeBuilding: 1,
  asset: 0,
  assetName: 'adult',
  model: 'model',
  memorySystem: 'memory',
  planSystem: 'plan',
  workBuilding: null,
  nickname: 'Ada',
  bio: 'bio',
  goal: 'goal',
  cash: 100,
  x: 0,
  y: 0,
} as const;

const buildingFixture = {
  id: 7,
  n: 'Cafe',
  o: 'Player-1',
  t: 'cafe',
  lx: 0,
  ty: 0,
  rx: 1,
  by: 1,
  r: 0,
  x: 0,
  y: 0,
  eI: 0,
  eE: 0,
  eT: 0,
  hL: [],
  hC: 0,
  lL: [],
  lC: 0,
  rI: 10,
  rT: 0,
} as const;
