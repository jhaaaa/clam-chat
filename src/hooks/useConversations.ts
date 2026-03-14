import { useState, useEffect, useCallback, useRef } from "react";
import {
  ConsentState,
  Dm,
  Group,
  IdentifierKind,
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
      const filteredAllowed = allowed.filter(
        (c) => c instanceof Dm || c instanceof Group
      );

      const unknown = await client.conversations.list({
        consentStates: [ConsentState.Unknown],
      });
      const filteredUnknown = unknown.filter(
        (c) => c instanceof Dm || c instanceof Group
      );

      // Reactivate inactive DMs by creating duplicate DMs (triggers stitching).
      // Per XMTP docs: "you may choose to programmatically create a duplicate DM
      // for every inactive DM to trigger stitching. This will activate the DM conversations."
      let reactivated = false;
      const allConvs = [...filteredAllowed, ...filteredUnknown];
      for (const conv of allConvs) {
        if (!(conv instanceof Dm)) continue;
        try {
          if (await conv.isActive()) continue;
          const peerInboxId = await (conv as Dm).peerInboxId();
          const members = await conv.members();
          const peer = members.find((m) => m.inboxId === peerInboxId);
          const peerAddress = peer?.accountIdentifiers?.[0]?.identifier;
          if (peerAddress) {
            console.log("[clam-chat] Reactivating inactive DM with", peerAddress);
            await client.conversations.createDmWithIdentifier({
              identifier: peerAddress,
              identifierKind: IdentifierKind.Ethereum,
            });
            reactivated = true;
          }
        } catch (err) {
          console.warn("[clam-chat] Failed to reactivate DM:", err);
        }
      }

      // If we reactivated any DMs, re-list to get updated state
      if (reactivated) {
        const refreshed = await client.conversations.list({
          consentStates: [ConsentState.Allowed],
        });
        setConversations(
          refreshed.filter((c) => c instanceof Dm || c instanceof Group)
        );
        const refreshedUnknown = await client.conversations.list({
          consentStates: [ConsentState.Unknown],
        });
        setRequests(
          refreshedUnknown.filter((c) => c instanceof Dm || c instanceof Group)
        );
      } else {
        setConversations(filteredAllowed);
        setRequests(filteredUnknown);
      }
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
