import type {
  BuildingDTO,
  JsonValue,
  MapDTO,
  NPCDTO,
  NPCUid,
  PlayerDTO,
  TownDTO,
  Uid,
} from './dtos';

export const REQUEST_URIS = [
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
] as const;
export type RequestUri = (typeof REQUEST_URIS)[number];
export type Uri = RequestUri;
export type EmptyData = Readonly<Record<never, never>>;

export type RequestDataByUri = {
  readonly ping: EmptyData;
  readonly 'command.auth.Register': {
    readonly nickname: string;
    readonly email: string;
    readonly cryptoPWD: string;
  };
  readonly 'command.building.Create': {
    readonly building_type: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly rotation: number;
  };
  readonly 'command.building.GetBuildings': EmptyData;
  readonly 'command.building.GetBuildingInfo': { readonly buildingID: number };
  readonly 'command.npc.Create': {
    readonly asset: string;
    readonly model: string;
    readonly memorySystem: string;
    readonly planSystem: string;
    readonly homeBuilding: number;
    readonly workBuilding: number;
    readonly nickname: string;
    readonly bio: string;
    readonly goal: string;
    readonly cash: number;
  };
  readonly 'command.npc.GetNPCs': EmptyData;
  readonly 'command.npc.GetNPCInfo': { readonly NPCID: number };
  readonly 'command.npc.ChangePrompt': {
    readonly NPCID: number;
    readonly promptType: string;
    readonly promptText: string;
  };
  readonly 'command.map.Navigate': { readonly x: number; readonly y: number };
  readonly 'command.map.GetMapScene': EmptyData;
  readonly 'command.map.GetMapTown': EmptyData;
  readonly 'command.chat.ChatWithNPC': { readonly NPCID: NPCUid; readonly content: string };
  readonly 'command.player.GetPlayerInfo': EmptyData;
  readonly 'command.mayor.GetInfo': EmptyData;
  readonly 'command.config.GetBuildingsConfig': EmptyData;
  readonly 'command.config.GetNPCsConfig': EmptyData;
  readonly 'command.config.GetEquipmentsConfig': EmptyData;
  readonly 'command.timetick.Tick': EmptyData;
  readonly 'command.starter.TickStarter': EmptyData;
  readonly 'command.starter.MayorStarter': EmptyData;
  readonly 'command.gm.FakeSendings': {
    readonly testName: 'movePath' | 'changeRevenue' | 'changeCash' | 'increaseBuildingIncome';
  };
};

export type RequestFrameByUri<U extends RequestUri> = {
  readonly uid: Uid;
  readonly uri: U;
  readonly method: unknown;
  readonly data: RequestDataByUri[U];
};
export type RequestFrame = { readonly [U in RequestUri]: RequestFrameByUri<U> }[RequestUri];
export const REQUEST_URI_METADATA = {
  'command.npc.ChangePrompt': { backendStatus: 'broken' },
} as const;
export type RequestUriMetadata = typeof REQUEST_URI_METADATA;

export type MayorBuildingInfo = {
  readonly id: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly income: number;
  readonly beds: number;
  readonly livings: readonly Uid[];
};
export type MayorNPCInfo = {
  readonly id: NPCUid;
  readonly name: string;
  readonly bio: string;
  readonly goal: string;
  readonly cash: number;
};
export type ConfigEntry = Readonly<Record<string, JsonValue>>;

export type RequestResponseData = {
  readonly ping: { readonly ping: true };
  readonly 'command.auth.Register': {
    readonly email: string;
    readonly nickname: string;
    readonly cryptoPWD: string;
    readonly uid: Uid;
    readonly buildings: readonly BuildingDTO[];
    readonly npcs: readonly NPCDTO[];
    readonly register?: true;
  };
  readonly 'command.building.Create': {
    readonly building_id: number;
    readonly x: number;
    readonly y: number;
    readonly building_type: string;
    readonly name: string;
  };
  readonly 'command.building.GetBuildings': { readonly buildings: readonly BuildingDTO[] };
  readonly 'command.building.GetBuildingInfo': { readonly building: BuildingDTO };
  readonly 'command.npc.Create': {
    readonly uid: NPCUid;
    readonly homeBuilding: number;
    readonly asset: number;
    readonly assetName: string;
    readonly model: string;
    readonly memorySystem: string;
    readonly planSystem: string;
    readonly workBuilding: number | null;
    readonly nickname: string;
    readonly bio: string;
    readonly goal: string;
    readonly cash: number;
    readonly x: number;
    readonly y: number;
  };
  readonly 'command.npc.GetNPCs': { readonly npcs: readonly NPCDTO[] };
  readonly 'command.npc.GetNPCInfo': { readonly npc: NPCDTO };
  readonly 'command.npc.ChangePrompt': { readonly result: true };
  readonly 'command.map.Navigate': {
    readonly nowPositionX: number;
    readonly nowPositionY: number;
    readonly remainPath: JsonValue;
  };
  readonly 'command.map.GetMapScene': { readonly map: MapDTO };
  readonly 'command.map.GetMapTown': { readonly town: TownDTO };
  readonly 'command.chat.ChatWithNPC': { readonly npc: NPCDTO; readonly player: PlayerDTO };
  readonly 'command.player.GetPlayerInfo': { readonly player: PlayerDTO };
  readonly 'command.mayor.GetInfo': {
    readonly last_game_time: number;
    readonly start_time: number;
    readonly revenue: number;
    readonly buildings: readonly MayorBuildingInfo[];
    readonly npcs: readonly MayorNPCInfo[];
    readonly building_types: readonly ConfigEntry[];
  };
  readonly 'command.config.GetBuildingsConfig': { readonly configs: readonly ConfigEntry[] };
  readonly 'command.config.GetNPCsConfig': {
    readonly configs: ConfigEntry | readonly ConfigEntry[];
  };
  readonly 'command.config.GetEquipmentsConfig': { readonly configs: readonly ConfigEntry[] };
  readonly 'command.timetick.Tick': {
    readonly moving: number;
    readonly chatted: number;
    readonly using: number;
    readonly inited: number;
    readonly cache: number;
  };
  readonly 'command.starter.TickStarter': { readonly start: true };
  readonly 'command.starter.MayorStarter': { readonly start: true };
  readonly 'command.gm.FakeSendings': { readonly result: true };
};
