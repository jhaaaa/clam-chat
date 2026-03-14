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

  // Sync + load messages. If sync fails, still try loading cached messages.
  // On a second device there's no local cache, so retry sync once if empty.
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
      let msgs = await conversation.messages();
      // On a fresh device, sync may fail silently and return no messages.
      // Retry once to give the network a second chance.
      if (msgs.length === 0) {
        try {
          await conversation.sync();
        } catch {
          // best-effort retry
        }
        msgs = await conversation.messages();
      }
      setMessages(msgs);
    } catch (err) {
      console.error("[clam-chat] Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [conversation]);

  // Load messages and start streaming when conversation changes
  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      return;
    }

    // Skip if same conversation
    if (conversationIdRef.current === conversation.id) return;
    conversationIdRef.current = conversation.id;

    // Clean up previous stream
    streamRef.current?.end();
    streamRef.current = null;

    // Load history
    loadMessages();

    // Re-load messages without spinner (for reactions, stream catch-up, etc.)
    const reloadMessages = async () => {
      try {
        await conversation.sync();
      } catch {
        // Sync failed — still try loading cached messages
      }
      try {
        const msgs = await conversation.messages();
        setMessages(msgs);
      } catch (err) {
        console.error("[clam-chat] Failed to reload messages:", err);
      }
    };

    // Start streaming new messages
    const startStream = async () => {
      try {
        const stream = await conversation.stream({
          onValue: (message: DecodedMessage) => {
            const typeId = message.contentType?.typeId;
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

  // Refresh messages after a send operation
  const refreshAfterSend = useCallback(async () => {
    if (!conversation) return;
    try {
      await conversation.sync();
    } catch {
      // Best-effort sync
    }
    try {
      const msgs = await conversation.messages();
      setMessages(msgs);
    } catch {
      // Best-effort refresh
    }
  }, [conversation]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversation || !text.trim()) return;
      try {
        await conversation.sendText(text.trim());
      } catch (err) {
        if (isSyncNoise(err)) {
          console.log("[clam-chat] Send noise:", (err as Error).message);
        } else {
          console.error("[clam-chat] Failed to send message:", err);
          throw err;
        }
      }
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend]
  );

  const sendReaction = useCallback(
    async (messageId: string, referenceInboxId: string, emoji: string, action: "add" | "remove") => {
      if (!conversation) return;
      try {
        await conversation.sendReaction({
          reference: messageId,
          referenceInboxId,
          action:
            action === "add" ? ReactionAction.Added : ReactionAction.Removed,
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
      try {
        const encoded = await encodeText(text.trim());
        await conversation.sendReply({
          reference: referenceId,
          referenceInboxId,
          content: encoded,
        });
      } catch (err) {
        if (isSyncNoise(err)) {
          console.log("[clam-chat] Reply noise:", (err as Error).message);
        } else {
          console.error("[clam-chat] Failed to send reply:", err);
          throw err;
        }
      }
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend]
  );

  const sendInlineAttachment = useCallback(
    async (attachment: Attachment) => {
      if (!conversation) return;
      try {
        await conversation.sendAttachment(attachment);
      } catch (err) {
        if (!isSyncNoise(err)) {
          console.error("[clam-chat] Failed to send attachment:", err);
          throw err;
        }
      }
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend]
  );

  const sendRemoteAttachmentMsg = useCallback(
    async (remoteAttachment: RemoteAttachment) => {
      if (!conversation) return;
      try {
        await conversation.sendRemoteAttachment(remoteAttachment);
      } catch (err) {
        if (!isSyncNoise(err)) {
          console.error("[clam-chat] Failed to send remote attachment:", err);
          throw err;
        }
      }
      await refreshAfterSend();
    },
    [conversation, refreshAfterSend]
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
