import { useEffect, useRef, useCallback } from "react";
import { GroupMessageKind, type DecodedMessage } from "@xmtp/browser-sdk";
import MessageBubble from "./MessageBubble";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface MessageListProps {
  messages: DecodedMessage[];
  selfInboxId: string;
  isLoading: boolean;
  memberAddresses: Map<string, string>;
  onReact: (messageId: string, referenceInboxId: string, emoji: string, action: "add" | "remove") => void;
  onReply: (message: DecodedMessage) => void;
}

export default function MessageList({
  messages,
  selfInboxId,
  isLoading,
  memberAddresses,
  onReact,
  onReply,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [isLoading, messages.length > 0]);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = containerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-indigo-50");
      setTimeout(() => el.classList.remove("bg-indigo-50"), 1500);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="md" label="Loading messages..." />
      </div>
    );
  }

  // Filter out system messages (membership changes, group updates)
  const userMessages = messages.filter(
    (msg) => msg.kind === GroupMessageKind.Application
  );

  if (userMessages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-sm">No messages yet. Say hello!</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
    >
      <div className="space-y-3">
        {userMessages.map((msg) => (
          <div key={msg.id} data-message-id={msg.id} className="rounded-lg transition-colors duration-700">
            <MessageBubble
              message={msg}
              isSelf={msg.senderInboxId === selfInboxId}
              selfInboxId={selfInboxId}
              senderAddress={memberAddresses.get(msg.senderInboxId)}
              onReact={onReact}
              onReply={onReply}
              onScrollToMessage={scrollToMessage}
            />
          </div>
        ))}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
