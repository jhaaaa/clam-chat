import { useState, useEffect, useCallback, useRef } from "react";
import {
  ConsentState,
  Dm,
  Group,
  type Conversation,
  type Client,
} from "@xmtp/browser-sdk";
import { useChatStore } from "@/store/chatStore";

export function useConversations(client: Client | null) {
  const conversationListVersion = useChatStore(
    (s) => s.conversationListVersion
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<{ end: () => void } | null>(null);

  const loadConversations = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      // Sync conversations from the network. The per-conversation syncs in
      // ConversationItem were the real concurrency problem (removed); a single
      // syncAll() here is safe and needed to catch new incoming conversations.
      await client.conversations.syncAll([
        ConsentState.Allowed,
        ConsentState.Unknown,
      ]);

      const allowed = await client.conversations.list({
        consentStates: [ConsentState.Allowed],
      });
      // Filter to DMs and Groups (skip internal Sync/Oneshot types)
      setConversations(
        allowed.filter((c) => c instanceof Dm || c instanceof Group)
      );

      const unknown = await client.conversations.list({
        consentStates: [ConsentState.Unknown],
      });
      setRequests(
        unknown.filter((c) => c instanceof Dm || c instanceof Group)
      );
    } catch (err) {
      console.error("[clam-chat] Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Stream new conversations
  useEffect(() => {
    if (!client) return;

    const startStream = async () => {
      try {
        const stream = await client.conversations.stream({
          onValue: (conversation) => {
            console.log("[clam-chat] New conversation streamed:", conversation.id);
            const addToList = async () => {
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
            };
            addToList();
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

  // Load on mount and when conversation list version changes (e.g. consent update)
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
