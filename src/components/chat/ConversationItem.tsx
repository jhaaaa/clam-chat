import { useState, useEffect, useRef } from "react";
import { type Conversation, type DecodedMessage, Dm, Group, isReply } from "@xmtp/browser-sdk";
import type { EnrichedReply } from "@xmtp/browser-sdk";
import { formatDistanceToNow } from "date-fns";
import { ensClient } from "@/lib/ens";

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  searchFilter?: string;
}

function extractText(msg: DecodedMessage): string {
  try {
    if (isReply(msg)) {
      const reply = msg.content as EnrichedReply;
      return typeof reply.content === "string" ? reply.content : msg.fallback || "";
    }
  } catch {
    // isReply may throw for some content types — fall through
  }
  if (typeof msg.content === "string") return msg.content;
  if (msg.content && typeof msg.content === "object") {
    if ("text" in msg.content) return (msg.content as { text: string }).text;
    if ("content" in msg.content) {
      const inner = (msg.content as { content: unknown }).content;
      if (typeof inner === "string") return inner;
    }
  }
  return msg.fallback || "";
}

export default function ConversationItem({
  conversation,
  isSelected,
  onClick,
  searchFilter,
}: ConversationItemProps) {
  const [label, setLabel] = useState("");
  const [sublabel, setSublabel] = useState("");
  const [lastMessagePreview, setLastMessagePreview] = useState("");
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [messageMatch, setMessageMatch] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isDm = conversation instanceof Dm;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (isDm) {
          // Get peer's Ethereum address from members
          const peerInboxId = await (conversation as Dm).peerInboxId();
          const members = await conversation.members();
          const peer = members.find((m) => m.inboxId === peerInboxId);
          const peerAddress = peer?.accountIdentifiers?.[0]?.identifier;

          if (!cancelled && peerAddress) {
            const shortAddr = peerAddress.slice(0, 6) + "..." + peerAddress.slice(-4);
            setLabel(shortAddr);

            // Try reverse ENS lookup
            try {
              const ensName = await ensClient.getEnsName({ address: peerAddress as `0x${string}` });
              if (!cancelled && ensName) {
                setLabel(ensName);
                setSublabel(shortAddr);
              }
            } catch {
              // ENS lookup failed — short address is fine
            }
          } else if (!cancelled) {
            setLabel(peerInboxId.slice(0, 8) + "..." + peerInboxId.slice(-4));
          }
        } else if (conversation instanceof Group) {
          const name = (conversation as Group).name || "Group";
          const members = await conversation.members();
          if (!cancelled) {
            setLabel(name);
            setMemberCount(members.length);
          }
        }
      } catch (err) {
        console.error("[clam-chat] Error loading conversation label:", err);
      }

      // Load last message preview — uses locally cached messages (synced by syncAll)
      try {
        const recentMessages = await conversation.messages({ limit: 20n });
        if (!cancelled && recentMessages.length > 0) {
          // Find the most recent displayable message (skip reactions)
          let foundText = false;
          for (const msg of recentMessages) {
            if (msg.contentType?.typeId === "reaction") continue;
            const text = extractText(msg);
            if (text) {
              setLastMessagePreview(
                text.length > 60 ? text.slice(0, 60) + "..." : text
              );
              setLastMessageTime(msg.sentAt);
              foundText = true;
              break;
            }
          }
          // If no text found, still show the latest timestamp
          if (!foundText && recentMessages[0]) {
            setLastMessagePreview("[attachment]");
            setLastMessageTime(recentMessages[0].sentAt);
          }
        }
      } catch (err) {
        console.error("[clam-chat] Error loading last message:", err);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [conversation, isDm]);

  // Debounced message content search
  useEffect(() => {
    clearTimeout(searchTimerRef.current);

    if (!searchFilter || searchFilter.length < 2) {
      setMessageMatch(null);
      return;
    }

    // If label already matches, skip message search
    if (label && label.toLowerCase().includes(searchFilter.toLowerCase())) {
      setMessageMatch(null);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        // Search locally cached messages — no sync to avoid N concurrent syncs
        const messages = await conversation.messages({ limit: 100n });
        const query = searchFilter.toLowerCase();

        for (const msg of messages) {
          const text = extractText(msg);
          const idx = text.toLowerCase().indexOf(query);
          if (idx !== -1) {
            // Build a snippet around the match
            const start = Math.max(0, idx - 20);
            const end = Math.min(text.length, idx + searchFilter.length + 30);
            const snippet =
              (start > 0 ? "..." : "") +
              text.slice(start, end) +
              (end < text.length ? "..." : "");
            setMessageMatch(snippet);
            return;
          }
        }
        setMessageMatch(null);
      } catch {
        setMessageMatch(null);
      }
    }, 300);

    return () => clearTimeout(searchTimerRef.current);
  }, [searchFilter, label, conversation]);

  // Hide if search active and neither label nor message content matches
  const labelMatches = !searchFilter || !label || label.toLowerCase().includes(searchFilter.toLowerCase());
  if (searchFilter && searchFilter.length >= 2 && !labelMatches && messageMatch === null) {
    return null;
  }
  // For single-character searches, keep label-only filtering
  if (searchFilter && searchFilter.length < 2 && label && !label.toLowerCase().includes(searchFilter.toLowerCase())) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
        isSelected
          ? "bg-indigo-50 border border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800"
          : "hover:bg-gray-50 border border-transparent dark:hover:bg-gray-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* Icon */}
            <span className="text-base">
              {isDm ? "\u270C\uFE0F" : "\u{1F347}"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {label || "Loading..."}
              </p>
              {sublabel && (
                <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                  {sublabel}
                </p>
              )}
            </div>
            {!isDm && memberCount > 0 && (
              <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {memberCount}
              </span>
            )}
          </div>
          {messageMatch && searchFilter ? (
            <p className="mt-0.5 truncate pl-6 text-xs text-indigo-600 dark:text-indigo-400">
              {messageMatch}
            </p>
          ) : lastMessagePreview ? (
            <p className="mt-0.5 truncate pl-6 text-sm text-gray-600 dark:text-gray-400">
              {lastMessagePreview}
            </p>
          ) : null}
        </div>
        {lastMessageTime && (
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {formatDistanceToNow(lastMessageTime, { addSuffix: false })}
          </span>
        )}
      </div>
    </button>
  );
}
