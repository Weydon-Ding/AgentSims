import { create } from 'zustand';

import type { JsonValue, NPCUid, Uid } from '../protocol/dtos';
import type { PushDataByUri } from '../protocol/pushes';

type SimStore = {
  readonly targetBuilding?: { readonly uid: NPCUid; readonly id: number; readonly name: string };
  readonly interactions: Readonly<Record<Uid, PushDataByUri['interact']>>;
  readonly actions: Readonly<Record<NPCUid, JsonValue>>;
  readonly setTargetBuilding: (targetBuilding: NonNullable<SimStore['targetBuilding']>) => void;
  readonly setInteraction: (interaction: PushDataByUri['interact']) => void;
  readonly setAction: (uid: NPCUid, action: JsonValue) => void;
  readonly reset: () => void;
};

const initialSimState = {
  interactions: {},
  actions: {},
} satisfies Pick<SimStore, 'interactions' | 'actions'>;

export const useSimStore = create<SimStore>((set) => ({
  ...initialSimState,
  setTargetBuilding: (targetBuilding) => set({ targetBuilding }),
  setInteraction: (interaction) =>
    set((state) => ({ interactions: { ...state.interactions, [interaction.uid]: interaction } })),
  setAction: (uid, action) => set((state) => ({ actions: { ...state.actions, [uid]: action } })),
  reset: () => set(initialSimState),
}));
