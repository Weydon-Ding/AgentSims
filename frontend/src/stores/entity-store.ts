import { create } from 'zustand';

import type { BuildingDTO, EquipmentDTO, NPCDTO, PlayerDTO, Position, Uid } from '../protocol/dtos';

type EntityStore = {
  readonly npcs: Readonly<Record<string, Readonly<Partial<NPCDTO>>>>;
  readonly players: Readonly<Record<string, Readonly<Partial<PlayerDTO>>>>;
  readonly buildings: Readonly<Record<number, BuildingDTO>>;
  readonly equipments: Readonly<Record<number, EquipmentDTO>>;
  readonly paths: Readonly<Record<Uid, readonly Position[]>>;
  readonly positions: Readonly<Record<Uid, Position>>;
  readonly upsertNpc: (uid: string, npc: NPCDTO) => void;
  readonly patchNpc: (uid: string, patch: Readonly<Partial<NPCDTO>>) => void;
  readonly patchPlayer: (uid: string, patch: Readonly<Partial<PlayerDTO>>) => void;
  readonly upsertBuilding: (building: BuildingDTO) => void;
  readonly setPath: (uid: Uid, path: readonly Position[]) => void;
  readonly setPosition: (uid: Uid, position: Position) => void;
  readonly reset: () => void;
};

const initialEntityState = {
  npcs: {},
  players: {},
  buildings: {},
  equipments: {},
  paths: {},
  positions: {},
} satisfies Pick<
  EntityStore,
  'npcs' | 'players' | 'buildings' | 'equipments' | 'paths' | 'positions'
>;

export const useEntityStore = create<EntityStore>((set) => ({
  ...initialEntityState,
  upsertNpc: (uid, npc) => set((state) => ({ npcs: { ...state.npcs, [uid]: npc } })),
  patchNpc: (uid, patch) =>
    set((state) => ({ npcs: { ...state.npcs, [uid]: { ...state.npcs[uid], ...patch } } })),
  patchPlayer: (uid, patch) =>
    set((state) => ({ players: { ...state.players, [uid]: { ...state.players[uid], ...patch } } })),
  upsertBuilding: (building) =>
    set((state) => ({ buildings: { ...state.buildings, [building.id]: building } })),
  setPath: (uid, path) => set((state) => ({ paths: { ...state.paths, [uid]: path } })),
  setPosition: (uid, position) =>
    set((state) => ({ positions: { ...state.positions, [uid]: position } })),
  reset: () => set(initialEntityState),
}));
