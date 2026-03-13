import { useState, useRef, useEffect } from "react";
import type { DecodedMessage, EnrichedReply } from "@xmtp/browser-sdk";
import { isReply } from "@xmtp/browser-sdk";

interface MessageInputProps {
  onSend: (text: string) => Promise<void>;
  onSendAttachment?: (file: File) => Promise<void>;
  disabled?: boolean;
  replyingTo?: DecodedMessage | null;
  onCancelReply?: () => void;
}

function getPreviewText(message: DecodedMessage): string {
  if (isReply(message)) {
    const reply = message.content as EnrichedReply;
    return typeof reply.content === "string" ? reply.content : message.fallback || "";
  }
  if (typeof message.content === "string") return message.content;
  return message.fallback || "";
}

export default function MessageInput({ onSend, onSendAttachment, disabled, replyingTo, onCancelReply }: MessageInputProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Escape key cancels active reply
  useEffect(() => {
    if (!replyingTo) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancelReply?.();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [replyingTo, onCancelReply]);

  const handleSend = async () => {
    if (!text.trim() || isSending || disabled) return;
    setIsSending(true);
    try {
      await onSend(text);
      setText("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch {
      // Error is logged in the hook
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendAttachment) return;
    setIsSending(true);
    try {
      await onSendAttachment(file);
    } catch {
      // Error is logged in the hook
    } finally {
      setIsSending(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      {/* Reply preview bar */}
      {replyingTo && (
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-800 dark:bg-gray-800">
          <div className="flex-1 truncate border-l-2 border-indigo-400 pl-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700 dark:text-gray-300">Replying to </span>
            <span className="text-gray-500">
              {getPreviewText(replyingTo).slice(0, 80)}
              {getPreviewText(replyingTo).length > 80 ? "..." : ""}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <span className="text-sm">&times;</span>
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Attachment button */}
        {onSendAttachment && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.zip,.json,.csv"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isSending}
              className="shrink-0 rounded-xl border border-gray-300 px-2.5 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Attach file"
            >
              📎
            </button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Type a message..."
          disabled={disabled || isSending}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
          className="btn-rainbow shrink-0 px-4 py-2.5 disabled:opacity-50"
        >
          {isSending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
