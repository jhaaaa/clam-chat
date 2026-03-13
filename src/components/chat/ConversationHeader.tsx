import { useState, useEffect } from "react";
import { ConsentState, Dm, Group, type Conversation } from "@xmtp/browser-sdk";
import { useChatStore } from "@/store/chatStore";
import { ensClient } from "@/lib/ens";

interface ConversationHeaderProps {
  conversation: Conversation;
  onConsentChanged: () => void;
  onShowGroupInfo?: () => void;
}

export default function ConversationHeader({
  conversation,
  onConsentChanged,
  onShowGroupInfo,
}: ConversationHeaderProps) {
  const { setSelectedConversation } = useChatStore();
  const [label, setLabel] = useState("");
  const [sublabel, setSublabel] = useState("");
  const [consentState, setConsentState] = useState<ConsentState | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isDm = conversation instanceof Dm;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (isDm) {
          const peerInboxId = await (conversation as Dm).peerInboxId();
          const members = await conversation.members();
          const peer = members.find((m) => m.inboxId === peerInboxId);
          const peerAddress = peer?.accountIdentifiers?.[0]?.identifier;

          if (!cancelled && peerAddress) {
            const shortAddr = peerAddress.slice(0, 6) + "..." + peerAddress.slice(-4);
            setLabel(shortAddr);

            try {
              const ensName = await ensClient.getEnsName({ address: peerAddress as `0x${string}` });
              if (!cancelled && ensName) {
                setLabel(ensName);
                setSublabel(shortAddr);
              }
            } catch {
              // ENS lookup failed
            }
          } else if (!cancelled) {
            setLabel(peerInboxId.slice(0, 8) + "..." + peerInboxId.slice(-4));
          }
        } else if (conversation instanceof Group) {
          const name = (conversation as Group).name || "Group";
          if (!cancelled) setLabel(name);
        }

        const consent = await conversation.consentState();
        if (!cancelled) setConsentState(consent);
      } catch (err) {
        console.error("[clam-chat] Error loading conversation header:", err);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [conversation, isDm]);

  const handleBlock = async () => {
    setIsUpdating(true);
    try {
      await conversation.updateConsentState(ConsentState.Denied);
      setConsentState(ConsentState.Denied);
      setShowMenu(false);
      onConsentChanged();
    } catch (err) {
      console.error("[clam-chat] Failed to block:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnblock = async () => {
    setIsUpdating(true);
    try {
      await conversation.updateConsentState(ConsentState.Allowed);
      setConsentState(ConsentState.Allowed);
      setShowMenu(false);
      onConsentChanged();
    } catch (err) {
      console.error("[clam-chat] Failed to unblock:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const isBlocked = consentState === ConsentState.Denied;

  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedConversation(null)}
          className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 md:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label="Back to conversations"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <span className="text-sm">{isDm ? "\u270C\uFE0F" : "\u{1F347}"}</span>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {label || "Loading..."}
          </p>
          {sublabel && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{sublabel}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {!isDm && onShowGroupInfo && (
          <button
            onClick={onShowGroupInfo}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            Info
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg px-2 py-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            ...
          </button>

        {showMenu && (
          <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {isBlocked ? (
              <button
                onClick={handleUnblock}
                disabled={isUpdating}
                className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 disabled:opacity-50"
              >
                Unblock
              </button>
            ) : (
              <button
                onClick={handleBlock}
                disabled={isUpdating}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Block
              </button>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
