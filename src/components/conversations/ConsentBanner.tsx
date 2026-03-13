import { useState } from "react";
import { ConsentState, type Conversation } from "@xmtp/browser-sdk";

interface ConsentBannerProps {
  conversation: Conversation;
  onAccepted: () => void;
  onBlocked: () => void;
}

export default function ConsentBanner({
  conversation,
  onAccepted,
  onBlocked,
}: ConsentBannerProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleAccept = async () => {
    setIsUpdating(true);
    try {
      await conversation.updateConsentState(ConsentState.Allowed);
      onAccepted();
    } catch (err) {
      console.error("[clam-chat] Failed to accept conversation:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBlock = async () => {
    setIsUpdating(true);
    try {
      await conversation.updateConsentState(ConsentState.Denied);
      onBlocked();
    } catch (err) {
      console.error("[clam-chat] Failed to block conversation:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        This is a message request. Do you want to allow this conversation?
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={handleAccept}
          disabled={isUpdating}
          className="btn-rainbow px-4 py-1.5 text-xs disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={handleBlock}
          disabled={isUpdating}
          className="rounded-lg bg-red-100 px-4 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50"
        >
          Block
        </button>
      </div>
    </div>
  );
}
