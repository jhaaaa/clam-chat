import {
  encryptAttachment,
  type Attachment,
  type EncryptedAttachment,
  type RemoteAttachment,
} from "@xmtp/browser-sdk";

// Max size for inline attachments (1MB)
const INLINE_MAX_BYTES = 1_000_000;

export function isInlineSize(file: File): boolean {
  return file.size <= INLINE_MAX_BYTES;
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const buffer = await file.arrayBuffer();
  return {
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    content: new Uint8Array(buffer),
  };
}

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Encrypt an attachment and upload the payload.
 * Returns a RemoteAttachment ready to send.
 *
 * Replace `uploadPayload` with your own storage backend
 * (S3 presigned URL, IPFS/Pinata, etc.).
 */
export async function encryptAndUpload(
  attachment: Attachment,
  uploadPayload: (encrypted: EncryptedAttachment) => Promise<string>
): Promise<RemoteAttachment> {
  const encrypted = await encryptAttachment(attachment);
  const url = await uploadPayload(encrypted);

  return {
    url,
    contentDigest: encrypted.contentDigest,
    secret: encrypted.secret,
    salt: encrypted.salt,
    nonce: encrypted.nonce,
    scheme: "https://",
    contentLength: encrypted.contentLength,
    filename: encrypted.filename,
  };
}

/**
 * Upload encrypted payload to Pinata IPFS (public pin).
 *
 * The file is publicly accessible on IPFS, but this is fine because:
 * - The content is already encrypted by XMTP's encryptAttachment()
 * - The filename is anonymized to "encrypted"
 * - The MIME type is "application/octet-stream"
 * - Decryption keys are only shared inside the E2E-encrypted XMTP message
 *
 * Private files (v3 API) require signed URLs with expiration, which don't
 * work for XMTP messages that persist indefinitely.
 *
 * Requires VITE_PINATA_JWT and VITE_PINATA_GATEWAY env vars.
 */
export async function pinataUploadPayload(
  encrypted: EncryptedAttachment
): Promise<string> {
  const jwt = import.meta.env.VITE_PINATA_JWT;
  const gateway = import.meta.env.VITE_PINATA_GATEWAY;

  if (!jwt || !gateway) {
    throw new Error(
      "Pinata not configured. Set VITE_PINATA_JWT and VITE_PINATA_GATEWAY in .env"
    );
  }

  const blob = new Blob([new Uint8Array(encrypted.payload)], {
    type: "application/octet-stream",
  });
  // Use a generic name — the real filename is inside the encrypted XMTP message,
  // so no need to leak it to the storage provider.
  const file = new File([blob], "encrypted", {
    type: "application/octet-stream",
  });

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${body}`);
  }

  const { IpfsHash } = await res.json();
  return `https://${gateway}/ipfs/${IpfsHash}`;
}

/**
 * Returns the best available upload function.
 * Uses Pinata if configured, otherwise falls back to local Blob URLs.
 */
export function getUploader(): (encrypted: EncryptedAttachment) => Promise<string> {
  if (import.meta.env.VITE_PINATA_JWT && import.meta.env.VITE_PINATA_GATEWAY) {
    return pinataUploadPayload;
  }
  console.warn(
    "[clam-chat] Pinata not configured — remote attachments will only work locally. " +
    "Set VITE_PINATA_JWT and VITE_PINATA_GATEWAY in .env for cross-device support."
  );
  return devUploadPayload;
}

/**
 * Fallback dev upload: converts encrypted payload to a Blob URL.
 * Works for testing locally but NOT for cross-device messaging.
 */
export async function devUploadPayload(
  encrypted: EncryptedAttachment
): Promise<string> {
  const blob = new Blob([new Uint8Array(encrypted.payload)], {
    type: "application/octet-stream",
  });
  return URL.createObjectURL(blob);
}
