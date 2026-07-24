import { create } from 'zustand';

import type { Uid } from '../protocol/dtos';

type ConnectionStore = {
  readonly uid: Uid | undefined;
  readonly welcome: (uid: Uid | undefined) => void;
  readonly reset: () => void;
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  uid: undefined,
  welcome: (uid) => set({ uid }),
  reset: () => set({ uid: undefined }),
}));
