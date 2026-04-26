import { create } from "zustand";
import type { Client, Conversation } from "@xmtp/browser-sdk";
import type { AuthMethod } from "@/lib/types";
import { LOCAL_STORAGE_KEYS } from "@/lib/constants";

interface ChatState {
  // Auth
  authMethod: AuthMethod | null;
  address: string | null;
  setAuth: (method: AuthMethod, address: string) => void;
  clearAuth: () => void;

  // XMTP
  client: Client | null;
  setClient: (client: Client | null) => void;
  isClientLoading: boolean;
  setClientLoading: (loading: boolean) => void;
  clientError: string | null;
  setClientError: (error: string | null) => void;

  // Conversations
  selectedConversation: Conversation | null;
  setSelectedConversation: (conv: Conversation | null) => void;
  conversationListVersion: number;
  refreshConversationList: () => void;
  lastMessagePreviews: Record<string, { text: string; time: Date }>;
  setLastMessagePreview: (conversationId: string, text: string, time: Date) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  // Auth
  authMethod: null,
  address: null,
  setAuth: (method, address) => set({ authMethod: method, address }),
  clearAuth: () =>
    set({
      authMethod: null,
      address: null,
      client: null,
      clientError: null,
      isClientLoading: false,
      selectedConversation: null,
      lastMessagePreviews: {},
    }),

  // XMTP
  client: null,
  setClient: (client) => set({ client }),
  isClientLoading: false,
  setClientLoading: (loading) => set({ isClientLoading: loading }),
  clientError: null,
  setClientError: (error) => set({ clientError: error }),
  // Conversations
  selectedConversation: null,
  setSelectedConversation: (conv) => set({ selectedConversation: conv }),
  conversationListVersion: 0,
  refreshConversationList: () =>
    set((state) => ({ conversationListVersion: state.conversationListVersion + 1 })),
  lastMessagePreviews: {},
  setLastMessagePreview: (conversationId, text, time) =>
    set((state) => ({
      lastMessagePreviews: {
        ...state.lastMessagePreviews,
        [conversationId]: { text, time },
      },
    })),
}));
