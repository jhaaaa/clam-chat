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
      // Sync latest from network
      await client.conversations.syncAll([ConsentState.Allowed]);

      const allowed = await client.conversations.list({
        consentStates: [ConsentState.Allowed],
      });
      // Filter to only active DMs and Groups (inactive = revoked installation)
      const filtered = allowed.filter(
        (c) => c instanceof Dm || c instanceof Group
      );
      const activeFlags = await Promise.all(
        filtered.map((c) => c.isActive())
      );
      setConversations(filtered.filter((_, i) => activeFlags[i]));

      const unknown = await client.conversations.list({
        consentStates: [ConsentState.Unknown],
      });
      const filteredUnknown = unknown.filter(
        (c) => c instanceof Dm || c instanceof Group
      );
      const unknownActiveFlags = await Promise.all(
        filteredUnknown.map((c) => c.isActive())
      );
      setRequests(filteredUnknown.filter((_, i) => unknownActiveFlags[i]));
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
              // Skip inactive conversations (revoked installations)
              if (!(await conversation.isActive())) return;
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
