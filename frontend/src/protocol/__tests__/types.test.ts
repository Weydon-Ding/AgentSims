import { describe, expect, it } from 'vitest';
import { PUSH_URIS, REQUEST_URIS } from '../types';
import type {
  NPCDTO,
  PushDataByUri,
  PushFrameByUri,
  RequestFrameByUri,
  RequestResponseData,
  RequestUri,
  TownDTO,
} from '../types';

const expectedRequestUris = [
  'ping',
  'command.auth.Register',
  'command.building.Create',
  'command.building.GetBuildings',
  'command.building.GetBuildingInfo',
  'command.npc.Create',
  'command.npc.GetNPCs',
  'command.npc.GetNPCInfo',
  'command.npc.ChangePrompt',
  'command.map.Navigate',
  'command.map.GetMapScene',
  'command.map.GetMapTown',
  'command.chat.ChatWithNPC',
  'command.player.GetPlayerInfo',
  'command.mayor.GetInfo',
  'command.config.GetBuildingsConfig',
  'command.config.GetNPCsConfig',
  'command.config.GetEquipmentsConfig',
  'command.timetick.Tick',
  'command.starter.TickStarter',
  'command.starter.MayorStarter',
  'command.gm.FakeSendings',
] as const satisfies readonly RequestUri[];
const expectedPushUris = [
  'welcome',
  'movePath',
  'moveTo',
  'NPC-React',
  'newPlan',
  'planToMove',
  'chatWith',
  'interact',
  'newAction',
  'finishAction',
  'changeCash',
  'changeRevenue',
  'increaseBuildingIncome',
  'mayor.npc.Create',
  'mayor.building.Create',
] as const;

const requestFrameStubs = {
  ping: { uid: 'Player-1', uri: 'ping', method: null, data: {} },
  'command.auth.Register': {
    uid: 'Player-1',
    uri: 'command.auth.Register',
    method: null,
    data: { nickname: 'Ada', email: 'ada@example.test', cryptoPWD: 'secret' },
  },
  'command.building.Create': {
    uid: 'Player-1',
    uri: 'command.building.Create',
    method: null,
    data: { building_type: 'house', name: 'Home', x: 1, y: 1, rotation: 0 },
  },
  'command.building.GetBuildings': {
    uid: 'Player-1',
    uri: 'command.building.GetBuildings',
    method: null,
    data: {},
  },
  'command.building.GetBuildingInfo': {
    uid: 'Player-1',
    uri: 'command.building.GetBuildingInfo',
    method: null,
    data: { buildingID: 1 },
  },
  'command.npc.Create': {
    uid: 'Player-1',
    uri: 'command.npc.Create',
    method: null,
    data: {
      asset: 'adult',
      model: 'model',
      memorySystem: 'memory',
      planSystem: 'plan',
      homeBuilding: 1,
      workBuilding: 2,
      nickname: 'Ada',
      bio: 'bio',
      goal: 'goal',
      cash: 100,
    },
  },
  'command.npc.GetNPCs': { uid: 'Player-1', uri: 'command.npc.GetNPCs', method: null, data: {} },
  'command.npc.GetNPCInfo': {
    uid: 'Player-1',
    uri: 'command.npc.GetNPCInfo',
    method: null,
    data: { NPCID: 8 },
  },
  'command.npc.ChangePrompt': {
    uid: 'Player-1',
    uri: 'command.npc.ChangePrompt',
    method: null,
    data: { NPCID: 8, promptType: 'plan', promptText: 'text' },
  },
  'command.map.Navigate': {
    uid: 'Player-1',
    uri: 'command.map.Navigate',
    method: null,
    data: { x: 2, y: 3 },
  },
  'command.map.GetMapScene': {
    uid: 'Player-1',
    uri: 'command.map.GetMapScene',
    method: null,
    data: {},
  },
  'command.map.GetMapTown': {
    uid: 'Player-1',
    uri: 'command.map.GetMapTown',
    method: null,
    data: {},
  },
  'command.chat.ChatWithNPC': {
    uid: 'Player-1',
    uri: 'command.chat.ChatWithNPC',
    method: null,
    data: { NPCID: 'NPC-8', content: 'hello' },
  },
  'command.player.GetPlayerInfo': {
    uid: 'Player-1',
    uri: 'command.player.GetPlayerInfo',
    method: null,
    data: {},
  },
  'command.mayor.GetInfo': {
    uid: 'Player-1',
    uri: 'command.mayor.GetInfo',
    method: null,
    data: {},
  },
  'command.config.GetBuildingsConfig': {
    uid: 'Player-1',
    uri: 'command.config.GetBuildingsConfig',
    method: null,
    data: {},
  },
  'command.config.GetNPCsConfig': {
    uid: 'Player-1',
    uri: 'command.config.GetNPCsConfig',
    method: null,
    data: {},
  },
  'command.config.GetEquipmentsConfig': {
    uid: 'Player-1',
    uri: 'command.config.GetEquipmentsConfig',
    method: null,
    data: {},
  },
  'command.timetick.Tick': {
    uid: 'Player-1',
    uri: 'command.timetick.Tick',
    method: null,
    data: {},
  },
  'command.starter.TickStarter': {
    uid: 'Player-1',
    uri: 'command.starter.TickStarter',
    method: null,
    data: {},
  },
  'command.starter.MayorStarter': {
    uid: 'Player-1',
    uri: 'command.starter.MayorStarter',
    method: null,
    data: {},
  },
  'command.gm.FakeSendings': {
    uid: 'Player-1',
    uri: 'command.gm.FakeSendings',
    method: null,
    data: { testName: 'movePath' },
  },
} as const satisfies { readonly [U in RequestUri]: RequestFrameByUri<U> };

describe('协议类型契约', () => {
  it('Given 已验证请求契约 When 检查 URI 表 Then 恰有 22 个完整 URI', () => {
    expect(REQUEST_URIS).toHaveLength(22);
    expect(REQUEST_URIS).toEqual(expectedRequestUris);
  });

  it('Given 已验证推送契约 When 检查 URI 表 Then 恰有 15 个完整 URI', () => {
    expect(PUSH_URIS).toHaveLength(15);
    expect(PUSH_URIS).toEqual(expectedPushUris);
  });

  it('Given 全部 request URI When 构造调用帧 Then 每个 URI 具有对应的 params stub', () => {
    expect(Object.keys(requestFrameStubs)).toEqual(REQUEST_URIS);
    expect(Object.values(requestFrameStubs)).toHaveLength(22);
  });

  it('Given 调用相关 ID 格式 When 构造帧 Then 每个 URI 只接受其后端格式', () => {
    const chat = {
      uid: 'Player-1',
      uri: 'command.chat.ChatWithNPC',
      method: null,
      data: { NPCID: 'NPC-8', content: 'hello' },
    } as const satisfies RequestFrameByUri<'command.chat.ChatWithNPC'>;
    const npcInfo = {
      uid: 'Player-1',
      uri: 'command.npc.GetNPCInfo',
      method: null,
      data: { NPCID: 8 },
    } as const satisfies RequestFrameByUri<'command.npc.GetNPCInfo'>;
    const buildingInfo = {
      uid: 'Player-1',
      uri: 'command.building.GetBuildingInfo',
      method: null,
      data: { buildingID: 3 },
    } as const satisfies RequestFrameByUri<'command.building.GetBuildingInfo'>;
    expect([chat.data.NPCID, npcInfo.data.NPCID, buildingInfo.data.buildingID]).toEqual([
      'NPC-8',
      8,
      3,
    ]);
  });

  it('Given chatWith 推送 When 构造两种后端载荷 Then 两种变体均被协议接受', () => {
    const direct = {
      sourceID: 'Player-1',
      targetID: 'NPC-8',
      content: 'hello',
    } as const satisfies PushDataByUri['chatWith'];
    const history = {
      chats: [{ content: 'hello', speaker: 'Ada', speakerID: 'NPC-8' }],
    } as const satisfies PushDataByUri['chatWith'];
    expect([direct, history]).toHaveLength(2);
  });

  it('Given welcome push 无 data When 构造真实帧 Then welcome 特例被接受', () => {
    const welcome = {
      code: 200,
      uri: 'welcome',
      msg: 'Welcome',
    } as const satisfies PushFrameByUri<'welcome'>;
    expect(welcome).not.toHaveProperty('data');
  });

  it('Given 每个 response URI When 检查映射 Then response data 不再是通配记录', () => {
    const ping = { ping: true } as const satisfies RequestResponseData['ping'];
    const changedPrompt = {
      result: true,
    } as const satisfies RequestResponseData['command.npc.ChangePrompt'];
    const npcCreate = {
      uid: 'NPC-8',
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
      x: 1,
      y: 1,
    } as const satisfies RequestResponseData['command.npc.Create'];
    expect([ping, changedPrompt, npcCreate.workBuilding]).toEqual([
      { ping: true },
      { result: true },
      null,
    ]);
  });

  it('Given ORM DTOs When id 由 as_object 控制 Then id 可省略且字段名保持稳定', () => {
    const npc: NPCDTO = {
      name: 'Ada',
      server: 'NPC-1',
      map: 1,
      cash: 2,
      x: 3,
      y: 4,
      rotation: 0,
      asset: 'a',
      model: 'm',
      memorySystem: 'memory',
      planSystem: 'plan',
      bio: 'bio',
      goal: 'goal',
      home_building: 1,
      work_building: null,
      reg_time: 1,
      login_time: 1,
      refresh_time: 1,
      timezone: 0,
      path: [],
      act: null,
      plan: null,
      event: null,
      last_move: 0,
      act_timeout: 0,
      chats: {},
    };
    const town: TownDTO = {
      taxes: 1,
      taxRate: 10,
      records: [],
      last_real_time: 1,
      last_game_time: 1,
    };
    expect(Object.keys(npc)).toEqual([
      'name',
      'server',
      'map',
      'cash',
      'x',
      'y',
      'rotation',
      'asset',
      'model',
      'memorySystem',
      'planSystem',
      'bio',
      'goal',
      'home_building',
      'work_building',
      'reg_time',
      'login_time',
      'refresh_time',
      'timezone',
      'path',
      'act',
      'plan',
      'event',
      'last_move',
      'act_timeout',
      'chats',
    ]);
    expect(Object.keys(town)).toEqual([
      'taxes',
      'taxRate',
      'records',
      'last_real_time',
      'last_game_time',
    ]);
    expect(npc.work_building).toBeNull();
  });
});
