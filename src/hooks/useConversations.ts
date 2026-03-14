import { useState, useEffect, useCallback, useRef } from "react";
import {
  ConsentState,
  Dm,
  Group,
  type Conversation,
  type Client,
} from "@xmtp/browser-sdk";
import { useChatStore } from "@/store/chatStore";

function isConversation(c: unknown): c is Conversation {
  return c instanceof Dm || c instanceof Group;
}

// Filter out inactive conversations (from revoked installations / identity resets)
async function filterActive(convos: Conversation[]): Promise<Conversation[]> {
  const results = await Promise.all(
    convos.map(async (c) => {
      try {
        return await c.isActive();
      } catch {
        return false;
      }
    })
  );
  return convos.filter((_, i) => results[i]);
}

export function useConversations(client: Client | null) {
  const conversationListVersion = useChatStore(
    (s) => s.conversationListVersion
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<{ end: () => void } | null>(null);

  // Sync from network, then list from local DB
  const loadConversations = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      // Pull new welcomes + unread messages for allowed and unknown conversations
      await client.conversations.syncAll([
        ConsentState.Allowed,
        ConsentState.Unknown,
      ]);

      const allowed = await client.conversations.list({
        consentStates: [ConsentState.Allowed],
      });
      const activeAllowed = await filterActive(allowed.filter(isConversation));
      setConversations(activeAllowed);

      const unknown = await client.conversations.list({
        consentStates: [ConsentState.Unknown],
      });
      const activeUnknown = await filterActive(unknown.filter(isConversation));
      setRequests(activeUnknown);
    } catch (err) {
      console.error("[clam-chat] Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Stream new conversations in real time
  useEffect(() => {
    if (!client) return;

    const startStream = async () => {
      try {
        const stream = await client.conversations.stream({
          onValue: async (conversation) => {
            if (!isConversation(conversation)) return;
            // Skip inactive conversations (from revoked installations)
            try {
              const active = await conversation.isActive();
              if (!active) return;
            } catch { return; }
            const consent = await conversation.consentState();
            if (consent === ConsentState.Allowed) {
              setConversations((prev) => {
                if (prev.some((c) => c.id === conversation.id)) return prev;
                return [conversation, ...prev];
              });
            } else if (consent === ConsentState.Unknown) {
              setRequests((prev) => {
                if (prev.some((c) => c.id === conversation.id)) return prev;
                return [conversation, ...prev];
              });
            }
          },
          onError: (error) => {
            console.error("[clam-chat] Conversation stream error:", error);
          },
        });
        streamRef.current = stream;
      } catch (err) {
        console.error("[clam-chat] Failed to start conversation stream:", err);
      }
    };

    startStream();

    return () => {
      streamRef.current?.end();
      streamRef.current = null;
    };
  }, [client]);

  // Load on mount and when version changes (consent update, new conversation, etc.)
  useEffect(() => {
    loadConversations();
  }, [loadConversations, conversationListVersion]);

  return {
    conversations,
    requests,
    isLoading,
    refresh: loadConversations,
  };
}
