import {
  isAttachment,
  isRemoteAttachment,
  isReply,
  type DecodedMessage,
  type EnrichedReply,
} from "@xmtp/browser-sdk";

/** Format an attachment filename as a preview label. */
export function attachmentPreviewLabel(filename?: string): string {
  return filename ? `📎 ${filename}` : "📎 Attachment";
}

/** Extract the display text from a decoded message (no truncation). */
export function extractMessageText(msg: DecodedMessage): string {
  // Attachments — show filename or generic label
  try {
    if (isAttachment(msg)) {
      const att = msg.content as { filename?: string };
      return attachmentPreviewLabel(att.filename);
    }
    if (isRemoteAttachment(msg)) {
      const att = msg.content as { filename?: string };
      return attachmentPreviewLabel(att.filename);
    }
  } catch {
    // fall through
  }
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

/** Truncate text to a max length for sidebar previews. */
export function truncatePreview(text: string, max = 60): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}
