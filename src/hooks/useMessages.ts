import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactionAction,
  ReactionSchema,
  encodeText,
  type Attachment,
  type Conversation,
  type DecodedMessage,
  type RemoteAttachment,
} from "@xmtp/browser-sdk";
import { useChatStore } from "@/store/chatStore";

// XMTP SDK sometimes throws sync status messages as errors even on success.
function isSyncNoise(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("synced") && msg.includes("succeeded");
}

export function useMessages(conversation: Conversation | null) {
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<{ end: () => void } | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const setLastMessagePreview = useChatStore((s) => s.setLastMessagePreview);

  // Sync conversation from network, then load messages from local DB
  const loadMessages = useCallback(async () => {
    if (!conversation) return;
    setIsLoading(true);
    try {
      await conversation.sync();
    } catch (err) {
      if (!isSyncNoise(err)) {
        console.warn("[clam-chat] Sync failed:", err);
      }
    }
    try {
      const msgs = await conversation.messages();
      setMessages(msgs);
    } catch (err) {
      console.error("[clam-chat] Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [conversation]);

  // When conversation changes: load history, start streaming
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    if (conversationIdRef.current === conversation.id) return;
    conversationIdRef.current = conversation.id;

    streamRef.current?.end();
    streamRef.current = null;

    loadMessages();

    // Reload messages from local DB without network sync
    // (the stream already wrote the data to the local DB)
    const reloadMessages = async () => {
      try {
        const msgs = await conversation.messages();
        setMessages(msgs);
      } catch (err) {
        console.error("[clam-chat] Failed to reload messages:", err);
      }
    };

    const startStream = async () => {
      try {
        const stream = await conversation.stream({
          onValue: (message: DecodedMessage) => {
            const typeId = message.contentType?.typeId;
            // Reactions and replies need a full reload for enriched data
            if (typeId === "reaction" || typeId === "reply") {
              reloadMessages();
              return;
            }
            setMessages((prev) => {
              if (prev.some((m) => m.id === message.id)) return prev;
              return [...prev, message];
            });
          },
          onError: (error: Error) => {
            console.error("[clam-chat] Message stream error:", error);
          },
        });
        streamRef.current = stream;
      } catch (err) {
        console.error("[clam-chat] Failed to start message stream:", err);
      }
    };

    startStream();

    return () => {
      streamRef.current?.end();
      streamRef.current = null;
      conversationIdRef.current = null;
    };
  }, [conversation, loadMessages]);

  // After sending: sync + reload to see own message, update conversation list preview
  const refreshAfterSend = useCallback(async () => {
    if (!conversation) return;
    try { await conversation.sync(); } catch { /* best-effort */ }
    try {
      const msgs = await conversation.messages();
      setMessages(msgs);
    } catch { /* best-effort */ }
  }, [conversation]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversation || !text.trim()) return;
      const trimmed = text.trim();
      try {
        await conversation.sendText(trimmed);
      } catch (err) {
        if (isSyncNoise(err)) {
          console.log("[clam-chat] Send noise:", (err as Error).message);
        } else {
          throw err;
        }
      }
      setLastMessagePreview(
        conversation.id,
        trimmed.length > 60 ? trimmed.slice(0, 60) + "..." : trimmed,
        new Date()
      );
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend, setLastMessagePreview]
  );

  const sendReaction = useCallback(
    async (messageId: string, referenceInboxId: string, emoji: string, action: "add" | "remove") => {
      if (!conversation) return;
      try {
        await conversation.sendReaction({
          reference: messageId,
          referenceInboxId,
          action: action === "add" ? ReactionAction.Added : ReactionAction.Removed,
          content: emoji,
          schema: ReactionSchema.Unicode,
        });
      } catch (err) {
        if (!isSyncNoise(err)) {
          console.error("[clam-chat] Failed to send reaction:", err);
        }
      }
    },
    [conversation]
  );

  const sendReply = useCallback(
    async (referenceId: string, referenceInboxId: string, text: string) => {
      if (!conversation || !text.trim()) return;
      const trimmed = text.trim();
      try {
        const encoded = await encodeText(trimmed);
        await conversation.sendReply({
          reference: referenceId,
          referenceInboxId,
          content: encoded,
        });
      } catch (err) {
        if (isSyncNoise(err)) {
          console.log("[clam-chat] Reply noise:", (err as Error).message);
        } else {
          throw err;
        }
      }
      setLastMessagePreview(
        conversation.id,
        trimmed.length > 60 ? trimmed.slice(0, 60) + "..." : trimmed,
        new Date()
      );
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend, setLastMessagePreview]
  );

  const sendInlineAttachment = useCallback(
    async (attachment: Attachment) => {
      if (!conversation) return;
      try {
        await conversation.sendAttachment(attachment);
      } catch (err) {
        if (!isSyncNoise(err)) throw err;
      }
      const label = attachment.filename ? `📎 ${attachment.filename}` : "📎 Attachment";
      setLastMessagePreview(conversation.id, label, new Date());
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend, setLastMessagePreview]
  );

  const sendRemoteAttachmentMsg = useCallback(
    async (remoteAttachment: RemoteAttachment) => {
      if (!conversation) return;
      try {
        await conversation.sendRemoteAttachment(remoteAttachment);
      } catch (err) {
        if (!isSyncNoise(err)) throw err;
      }
      const label = remoteAttachment.filename ? `📎 ${remoteAttachment.filename}` : "📎 Attachment";
      setLastMessagePreview(conversation.id, label, new Date());
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend, setLastMessagePreview]
  );

  return {
    messages,
    isLoading,
    sendMessage,
    sendReaction,
    sendReply,
    sendInlineAttachment,
    sendRemoteAttachment: sendRemoteAttachmentMsg,
    refresh: loadMessages,
  };
}
