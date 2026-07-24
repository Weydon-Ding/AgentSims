import { create } from 'zustand';

import type { ChatMessage } from '../protocol/pushes';

export type StoredChatMessage = ChatMessage & { readonly targetID?: string };

type ChatStore = {
  readonly messages: readonly StoredChatMessage[];
  readonly append: (message: StoredChatMessage) => void;
  readonly replace: (messages: readonly ChatMessage[]) => void;
  readonly reset: () => void;
};

const initialChatState = { messages: [] } satisfies Pick<ChatStore, 'messages'>;

export const useChatStore = create<ChatStore>((set) => ({
  ...initialChatState,
  append: (message) => set((state) => ({ messages: [...state.messages, message] })),
  replace: (messages) => set({ messages }),
  reset: () => set(initialChatState),
}));
