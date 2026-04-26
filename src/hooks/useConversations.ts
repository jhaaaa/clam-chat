import { useState, useEffect, useCallback, useRef } from "react";
import {
  ConsentState,
  Dm,
  Group,
  type Conversation,
  type Client,
  type DecodedMessage,
} from "@xmtp/browser-sdk";
import { useChatStore } from "@/store/chatStore";
import { extractMessageText, truncatePreview } from "@/lib/messagePreview";

function isConversation(c: unknown): c is Conversation {
  return c instanceof Dm || c instanceof Group;
}

export function useConversations(client: Client | null) {
  const conversationListVersion = useChatStore((s) => s.conversationListVersion);
  const setLastMessagePreview = useChatStore((s) => s.setLastMessagePreview);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const convStreamRef = useRef<{ end: () => void } | null>(null);
  const consentStreamRef = useRef<{ end: () => void } | null>(null);
  const msgStreamRef = useRef<{ end: () => void } | null>(null);

  // List from local DB, then sync from network.
  const loadConversations = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    try {
      // Show what's in the local DB immediately, then sync.
      const [allowedLocal, unknownLocal] = await Promise.all([
        client.conversations.list({ consentStates: [ConsentState.Allowed] }),
        client.conversations.list({ consentStates: [ConsentState.Unknown] }),
      ]);
      setConversations(allowedLocal.filter(isConversation));
      setRequests(unknownLocal.filter(isConversation));

      // Sync new welcomes + unread conversations from network.
      await client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]);

      // Sync consent state from other installations so the buckets are accurate.
      await client.preferences.sync();

      // Re-list after sync to pick up any new or reclassified conversations.
      const [allowedSynced, unknownSynced] = await Promise.all([
        client.conversations.list({ consentStates: [ConsentState.Allowed] }),
        client.conversations.list({ consentStates: [ConsentState.Unknown] }),
      ]);
      setConversations(allowedSynced.filter(isConversation));
      setRequests(unknownSynced.filter(isConversation));
    } catch (err) {
      console.error("[clam-chat] Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Start all three streams. Returns a cleanup function.
  const startStreams = useCallback(() => {
    if (!client) return;

    // Stream new conversations (real-time).
    client.conversations
      .stream({
        onValue: async (conversation) => {
          if (!isConversation(conversation)) return;
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
        onError: (err) => console.error("[clam-chat] Conversation stream error:", err),
      })
      .then((s) => { convStreamRef.current = s; })
      .catch((err) => console.error("[clam-chat] Failed to start conversation stream:", err));

    // Stream consent updates from other installations.
    client.preferences
      .streamConsent({
        onValue: () => { loadConversations(); },
        onError: (err) => console.error("[clam-chat] Consent stream error:", err),
      })
      .then((s) => { consentStreamRef.current = s; })
      .catch((err) => console.error("[clam-chat] Failed to start consent stream:", err));

    // Stream all messages for sidebar previews.
    // This also handles catch-up: messages missed while the tab was closed
    // are delivered here before real-time messages begin.
    client.conversations
      .streamAllMessages({
        consentStates: [ConsentState.Allowed, ConsentState.Unknown],
        onValue: (message: DecodedMessage) => {
          if (message.contentType?.typeId === "reaction") return;
          const preview = truncatePreview(extractMessageText(message));
          if (preview && message.conversationId) {
            setLastMessagePreview(message.conversationId, preview, message.sentAt);
          }
        },
        onError: (err) => console.error("[clam-chat] All-messages stream error:", err),
      })
      .then((s) => { msgStreamRef.current = s; })
      .catch((err) => console.error("[clam-chat] Failed to start all-messages stream:", err));
  }, [client, loadConversations, setLastMessagePreview]);

  const stopStreams = useCallback(() => {
    convStreamRef.current?.end();
    convStreamRef.current = null;
    consentStreamRef.current?.end();
    consentStreamRef.current = null;
    msgStreamRef.current?.end();
    msgStreamRef.current = null;
  }, []);

  // Start streams when client is ready.
  useEffect(() => {
    if (!client) return;
    startStreams();
    return stopStreams;
  }, [client, startStreams, stopStreams]);

  // When the tab comes back into focus after being away, streams may have
  // timed out (they retry for ~10 min then give up). Restart them and re-sync
  // so messages that arrived while the tab was closed are not missed.
  useEffect(() => {
    if (!client) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      stopStreams();
      startStreams();
      loadConversations();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [client, startStreams, stopStreams, loadConversations]);

  // Load on mount and when something triggers a refresh (consent, new conversation, etc.).
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
