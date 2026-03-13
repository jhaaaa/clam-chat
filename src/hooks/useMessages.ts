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

export function useMessages(conversation: Conversation | null) {
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const streamRef = useRef<{ end: () => void } | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!conversation) return;
    setIsLoading(true);
    try {
      await conversation.sync();
      const msgs = await conversation.messages();
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

    // Re-load messages without showing loading spinner (for reactions, etc.)
    const reloadMessages = async () => {
      try {
        await conversation.sync();
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
            // Reactions and replies arrive as separate messages in the stream
            // but should be grouped under their parent message. Re-sync to
            // get the properly grouped data.
            const typeId = message.contentType?.typeId;
            if (typeId === "reaction" || typeId === "reply") {
              reloadMessages();
              return;
            }

            setMessages((prev) => {
              // Avoid duplicates
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

  const sendMessage = useCallback(
    async (text: string) => {
      if (!conversation || !text.trim()) return;
      try {
        // Sync before sending to ensure conversation is active (fixes "Group is inactive")
        await conversation.sync();
        await conversation.sendText(text.trim());
      } catch (err) {
        // XMTP SDK sync noise — not a real error
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("synced") && msg.includes("succeeded")) {
          console.log("[clam-chat] Send sync info:", msg);
        } else {
          console.error("[clam-chat] Failed to send message:", err);
          throw err;
        }
      }
      // Refresh messages in case the stream didn't pick it up
      try {
        await conversation.sync();
        const msgs = await conversation.messages();
        setMessages(msgs);
      } catch {
        // Best-effort refresh
      }
    },
    [conversation]
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
        console.error("[clam-chat] Failed to send reaction:", err);
      }
    },
    [conversation]
  );

  const sendReply = useCallback(
    async (referenceId: string, referenceInboxId: string, text: string) => {
      if (!conversation || !text.trim()) return;
      try {
        await conversation.sync();
        const encoded = await encodeText(text.trim());
        await conversation.sendReply({
          reference: referenceId,
          referenceInboxId,
          content: encoded,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("synced") && msg.includes("succeeded")) {
          console.log("[clam-chat] Reply sync info:", msg);
        } else {
          console.error("[clam-chat] Failed to send reply:", err);
          throw err;
        }
      }
      try {
        await conversation.sync();
        const msgs = await conversation.messages();
        setMessages(msgs);
      } catch {
        // Best-effort refresh
      }
    },
    [conversation]
  );

  const sendInlineAttachment = useCallback(
    async (attachment: Attachment) => {
      if (!conversation) return;
      try {
        await conversation.sendAttachment(attachment);
      } catch (err) {
        console.error("[clam-chat] Failed to send attachment:", err);
        throw err;
      }
    },
    [conversation]
  );

  const sendRemoteAttachmentMsg = useCallback(
    async (remoteAttachment: RemoteAttachment) => {
      if (!conversation) return;
      try {
        await conversation.sendRemoteAttachment(remoteAttachment);
      } catch (err) {
        console.error("[clam-chat] Failed to send remote attachment:", err);
        throw err;
      }
    },
    [conversation]
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
