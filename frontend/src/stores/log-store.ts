import { create } from 'zustand';

import type { JsonValue, NPCUid } from '../protocol/dtos';

export type LogEntry =
  | { readonly kind: 'npc-reaction'; readonly uid: NPCUid; readonly reaction: JsonValue }
  | { readonly kind: 'unknown-push'; readonly message: string };

type LogStore = {
  readonly entries: readonly LogEntry[];
  readonly append: (entry: LogEntry) => void;
  readonly reset: () => void;
};

const initialLogState = { entries: [] } satisfies Pick<LogStore, 'entries'>;

export const useLogStore = create<LogStore>((set) => ({
  ...initialLogState,
  append: (entry) => set((state) => ({ entries: [...state.entries, entry] })),
  reset: () => set(initialLogState),
}));
