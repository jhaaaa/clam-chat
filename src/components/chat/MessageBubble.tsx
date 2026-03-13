import { useState, useCallback, useSyncExternalStore } from "react";
import {
  ReactionAction,
  isReply,
  isAttachment,
  isRemoteAttachment,
  type DecodedMessage,
  type EnrichedReply,
} from "@xmtp/browser-sdk";
import { formatDistanceToNow } from "date-fns";
import ReactionPicker from "./ReactionPicker";
import AttachmentDisplay from "./AttachmentDisplay";
import { useSenderName } from "@/hooks/useSenderName";

function bubbleColorFromAddress(address: string): { bg: string; text: string; timestamp: string; quoteBorder: string; quoteBg: string } {
  const hex = address.replace("0x", "").toLowerCase();
  const hue = parseInt(hex.slice(0, 4), 16) % 360;
  return {
    bg: `hsl(${hue}, 45%, 92%)`,
    text: `hsl(${hue}, 30%, 20%)`,
    timestamp: `hsl(${hue}, 20%, 55%)`,
    quoteBorder: `hsl(${hue}, 40%, 70%)`,
    quoteBg: `hsl(${hue}, 30%, 85%)`,
  };
}

function darkBubbleColorFromAddress(address: string): { bg: string; text: string; timestamp: string; quoteBorder: string; quoteBg: string } {
  const hex = address.replace("0x", "").toLowerCase();
  const hue = parseInt(hex.slice(0, 4), 16) % 360;
  return {
    bg: `hsl(${hue}, 30%, 20%)`,
    text: `hsl(${hue}, 20%, 90%)`,
    timestamp: `hsl(${hue}, 15%, 55%)`,
    quoteBorder: `hsl(${hue}, 30%, 35%)`,
    quoteBg: `hsl(${hue}, 25%, 25%)`,
  };
}

// Reactive dark mode detection via useSyncExternalStore
function subscribeToDarkMode(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
function getIsDark() {
  return document.documentElement.classList.contains("dark");
}


interface ReactionInfo {
  emoji: string;
  count: number;
  selfReacted: boolean;
}

interface MessageBubbleProps {
  message: DecodedMessage;
  isSelf: boolean;
  selfInboxId: string;
  senderAddress?: string;
  onReact: (messageId: string, referenceInboxId: string, emoji: string, action: "add" | "remove") => void;
  onReply: (message: DecodedMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
}

function getReactionSummary(
  reactions: DecodedMessage[],
  selfInboxId: string
): ReactionInfo[] {
  // Track active reactions per emoji per sender
  const emojiMap = new Map<string, Set<string>>();

  for (const r of reactions) {
    const content = r.content as {
      content: string;
      action: ReactionAction;
    } | undefined;
    if (!content) continue;

    const emoji = content.content;
    const sender = r.senderInboxId;

    if (content.action === ReactionAction.Added) {
      if (!emojiMap.has(emoji)) emojiMap.set(emoji, new Set());
      emojiMap.get(emoji)!.add(sender);
    } else if (content.action === ReactionAction.Removed) {
      emojiMap.get(emoji)?.delete(sender);
    }
  }

  const result: ReactionInfo[] = [];
  for (const [emoji, senders] of emojiMap) {
    if (senders.size > 0) {
      result.push({
        emoji,
        count: senders.size,
        selfReacted: senders.has(selfInboxId),
      });
    }
  }
  return result;
}

export default function MessageBubble({
  message,
  isSelf,
  selfInboxId,
  senderAddress,
  onReact,
  onReply,
  onScrollToMessage,
}: MessageBubbleProps) {
  const [showPicker, setShowPicker] = useState(false);

  const getAddress = useCallback(
    async () => senderAddress,
    [senderAddress]
  );
  const senderName = useSenderName(message.senderInboxId, getAddress);

  // Reactively track dark mode so bubble colors update when toggled
  const isDark = useSyncExternalStore(subscribeToDarkMode, getIsDark, () => false);

  // Generate address-based bubble colors for other people's messages
  const otherBubbleColors = senderAddress
    ? (isDark ? darkBubbleColorFromAddress(senderAddress) : bubbleColorFromAddress(senderAddress))
    : null;

  // Detect content types
  const isAttachmentMsg = isAttachment(message) || isRemoteAttachment(message);
  const replyContent = isReply(message)
    ? (message.content as EnrichedReply)
    : null;

  // Extract text content
  let text: string;
  if (replyContent) {
    // For replies, the content field holds the reply text
    text = typeof replyContent.content === "string"
      ? replyContent.content
      : message.fallback || "[Reply]";
  } else if (typeof message.content === "string") {
    text = message.content;
  } else if (
    message.content &&
    typeof message.content === "object" &&
    "text" in message.content
  ) {
    text = (message.content as { text: string }).text;
  } else if (message.fallback) {
    text = message.fallback;
  } else {
    text = "[Unsupported message type]";
  }

  // Extract quoted parent text for replies
  let quotedText: string | null = null;
  let quotedMessageId: string | null = null;
  if (replyContent) {
    quotedMessageId = replyContent.referenceId;
    if (replyContent.inReplyTo) {
      const parentContent = replyContent.inReplyTo.content;
      if (typeof parentContent === "string") {
        quotedText = parentContent;
      } else if (replyContent.inReplyTo.fallback) {
        quotedText = replyContent.inReplyTo.fallback;
      }
    }
    if (!quotedText) {
      quotedText = "[Original message]";
    }
  }


  const reactions = getReactionSummary(message.reactions || [], selfInboxId);

  const handleReactionClick = (emoji: string, selfReacted: boolean) => {
    onReact(message.id, message.senderInboxId, emoji, selfReacted ? "remove" : "add");
  };

  return (
    <div className={`group flex ${isSelf ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[75%]">
        {/* Action buttons — show on hover */}
        <div
          className={`absolute top-0 hidden items-center gap-0.5 group-hover:flex ${
            isSelf ? "-left-16" : "-right-16"
          }`}
        >
          <button
            onClick={() => onReply(message)}
            className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-400 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700"
            title="Reply"
          >
            ↩
          </button>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-400 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700"
            title="React"
          >
            +
          </button>
        </div>

        {/* Reaction picker */}
        {showPicker && (
          <div
            className={`absolute top-full z-30 mt-1 ${
              isSelf ? "right-0" : "left-0"
            }`}
          >
            <ReactionPicker
              onSelect={(emoji) => onReact(message.id, message.senderInboxId, emoji, "add")}
              onClose={() => setShowPicker(false)}
            />
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isSelf
              ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              : !otherBubbleColors
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                : ""
          }`}
          style={!isSelf && otherBubbleColors ? {
            backgroundColor: otherBubbleColors.bg,
            color: otherBubbleColors.text,
          } : undefined}
        >
          {!isSelf && (
            <p className="mb-0.5 flex items-center gap-1 text-sm font-medium" style={otherBubbleColors ? { color: otherBubbleColors.timestamp } : undefined}>
              {senderName.label}
            </p>
          )}
          {/* Quoted parent message for replies */}
          {quotedText && (
            <button
              onClick={() => quotedMessageId && onScrollToMessage?.(quotedMessageId)}
              className={`mb-1.5 w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
                isSelf
                  ? "border-gray-300 bg-gray-200/60 text-gray-500 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-400"
                  : ""
              }`}
              style={!isSelf && otherBubbleColors ? {
                borderColor: otherBubbleColors.quoteBorder,
                backgroundColor: otherBubbleColors.quoteBg,
              } : undefined}
            >
              <p className="line-clamp-2">{quotedText}</p>
            </button>
          )}
          {/* Attachment or text content */}
          {isAttachmentMsg ? (
            <AttachmentDisplay message={message} isSelf={isSelf} />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm">{text}</p>
          )}
          <p
            className={`mt-1 text-xs ${
              isSelf ? "text-gray-400 dark:text-gray-500" : ""
            }`}
            style={!isSelf && otherBubbleColors ? { color: otherBubbleColors.timestamp } : undefined}
          >
            {formatDistanceToNow(message.sentAt, { addSuffix: true })}
          </p>
        </div>

        {/* Reactions display */}
        {reactions.length > 0 && (
          <div
            className={`mt-1 flex flex-wrap gap-1 ${
              isSelf ? "justify-end" : "justify-start"
            }`}
          >
            {reactions.map(({ emoji, count, selfReacted }) => (
              <button
                key={emoji}
                onClick={() => handleReactionClick(emoji, selfReacted)}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  selfReacted
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                }`}
              >
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
