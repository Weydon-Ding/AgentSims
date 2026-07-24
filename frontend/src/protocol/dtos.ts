export type Uid = `Player-${number}` | `Mayor-${number}` | `NPC-${number}`;
export type NPCUid = `NPC-${number}`;
export type PlayerUid = `Player-${number}`;
export type MayorUid = `Mayor-${number}`;
export type JsonValue =
  boolean | null | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type Position = { readonly x: number; readonly y: number };

export type NPCDTO = {
  readonly id?: number;
  readonly name: string;
  readonly server: string;
  readonly map: number;
  readonly cash: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly asset: string;
  readonly model: string;
  readonly memorySystem: string;
  readonly planSystem: string;
  readonly bio: string;
  readonly goal: string;
  readonly home_building: number;
  // Backend legacy bug writes work_building_ during NPC creation, leaving this null.
  readonly work_building: number | null;
  readonly reg_time: number;
  readonly login_time: number;
  readonly refresh_time: number;
  readonly timezone: number;
  readonly path: readonly Position[];
  readonly act: JsonValue;
  readonly plan: JsonValue;
  readonly event: JsonValue;
  readonly last_move: number;
  readonly act_timeout: number;
  readonly chats: JsonValue;
};

export type MapBlock = {
  readonly block?: number;
  readonly uid?: Uid;
  readonly building?: number;
  readonly equipment?: number;
};
export type MapDTO = {
  readonly id?: number;
  readonly seed: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly map: Readonly<Record<string, Readonly<Record<string, MapBlock>>>>;
  readonly name2uid: Readonly<Record<string, Uid>>;
};

export type BuildingDTO = {
  readonly id: number;
  readonly n: string;
  readonly o: Uid;
  readonly t: string;
  readonly lx: number;
  readonly ty: number;
  readonly rx: number;
  readonly by: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
  readonly eI: number;
  readonly eE: number;
  readonly eT: number;
  readonly hL: readonly Uid[];
  readonly hC: number;
  readonly lL: readonly Uid[];
  readonly lC: number;
  readonly rI: number;
  readonly rT: number;
};
export type BuildingsDTO = { readonly id?: number; readonly buildings: readonly BuildingDTO[] };

export type EquipmentDTO = {
  readonly id: number;
  readonly n: string;
  readonly d: string;
  readonly o: Uid;
  readonly t: string;
  readonly lx: number;
  readonly ty: number;
  readonly rx: number;
  readonly by: number;
  readonly r: number;
  readonly b: number;
  readonly fs: JsonValue;
  readonly m: JsonValue;
  readonly s: JsonValue;
};
export type EquipmentsDTO = { readonly id?: number; readonly equipments: readonly EquipmentDTO[] };

export type PlayerDTO = {
  readonly id?: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly revenue: number;
  readonly reg_time: number;
  readonly login_time: number;
  readonly refresh_time: number;
  readonly timezone: number;
  readonly path: readonly Position[];
  readonly last_move: number;
  readonly chats: JsonValue;
};
export type TownDTO = {
  readonly id?: number;
  readonly taxes: number;
  readonly taxRate: number;
  readonly records: JsonValue;
  readonly last_real_time: number;
  readonly last_game_time: number;
};
