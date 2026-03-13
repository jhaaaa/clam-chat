import { useState, useEffect } from "react";
import {
  isAttachment,
  isRemoteAttachment,
  decryptAttachment,
  type DecodedMessage,
  type Attachment,
  type RemoteAttachment,
} from "@xmtp/browser-sdk";
import { isImageMimeType, formatFileSize } from "@/lib/attachments";

interface AttachmentDisplayProps {
  message: DecodedMessage;
  isSelf: boolean;
}

function InlineImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className="max-h-64 max-w-full rounded-lg"
      loading="lazy"
    />
  );
}

function FileCard({
  filename,
  size,
  downloadUrl,
  isSelf,
}: {
  filename: string;
  size: number;
  downloadUrl: string;
  isSelf: boolean;
}) {
  return (
    <a
      href={downloadUrl}
      download={filename}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        isSelf
          ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span className="text-lg">📎</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{filename}</p>
        <p className={isSelf ? "text-indigo-200" : "text-gray-400"}>
          {formatFileSize(size)}
        </p>
      </div>
    </a>
  );
}

function AttachmentContent({
  attachment,
  isSelf,
}: {
  attachment: Attachment;
  isSelf: boolean;
}) {
  const blob = new Blob([new Uint8Array(attachment.content)], { type: attachment.mimeType });
  const url = URL.createObjectURL(blob);
  const filename = attachment.filename || "attachment";

  if (isImageMimeType(attachment.mimeType)) {
    return <InlineImage src={url} alt={filename} />;
  }

  return (
    <FileCard
      filename={filename}
      size={attachment.content.byteLength}
      downloadUrl={url}
      isSelf={isSelf}
    />
  );
}

function RemoteAttachmentContent({
  remoteAttachment,
  isSelf,
}: {
  remoteAttachment: RemoteAttachment;
  isSelf: boolean;
}) {
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(remoteAttachment.url);
      if (!response.ok) throw new Error("Download failed");
      const encryptedBytes = new Uint8Array(await response.arrayBuffer());
      const decrypted = await decryptAttachment(
        encryptedBytes,
        remoteAttachment
      );
      setAttachment(decrypted);
    } catch (err) {
      console.error("[clam-chat] Failed to download attachment:", err);
      setError("Failed to load attachment");
    } finally {
      setLoading(false);
    }
  };

  // Auto-download for images
  useEffect(() => {
    if (
      remoteAttachment.filename &&
      isImageMimeType(guessMimeType(remoteAttachment.filename))
    ) {
      handleDownload();
    }
  }, [remoteAttachment.url]);

  if (attachment) {
    return <AttachmentContent attachment={attachment} isSelf={isSelf} />;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
        <span className="animate-pulse">⏳</span>
        <span>Downloading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={handleDownload}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
      >
        {error} — tap to retry
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        isSelf
          ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span className="text-lg">📎</span>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium">
          {remoteAttachment.filename || "Attachment"}
        </p>
        <p className={isSelf ? "text-indigo-200" : "text-gray-400"}>
          {formatFileSize(remoteAttachment.contentLength)} — tap to download
        </p>
      </div>
    </button>
  );
}

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  return map[ext || ""] || "application/octet-stream";
}

export default function AttachmentDisplay({
  message,
  isSelf,
}: AttachmentDisplayProps) {
  if (isAttachment(message)) {
    return (
      <AttachmentContent
        attachment={message.content as Attachment}
        isSelf={isSelf}
      />
    );
  }

  if (isRemoteAttachment(message)) {
    return (
      <RemoteAttachmentContent
        remoteAttachment={message.content as RemoteAttachment}
        isSelf={isSelf}
      />
    );
  }

  return null;
}
