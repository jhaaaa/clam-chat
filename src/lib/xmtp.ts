import { Client, ConsentState, getInboxIdForIdentifier, type Signer } from "@xmtp/browser-sdk";
import { XMTP_ENV, LOCAL_STORAGE_KEYS } from "./constants";

export async function createXmtpClient(signer: Signer): Promise<Client> {
  // Request persistent storage so Chrome (and other browsers) won't evict the
  // OPFS database. Without this, OPFS is "best effort" and Chrome can clear it
  // for origins not visited recently — which is why messages disappear after days.
  if (navigator.storage?.persist) {
    const persisted = await navigator.storage.persist();
    if (!persisted) {
      console.warn("[clam-chat] Persistent storage not granted — OPFS may be evicted by the browser");
    }
  }

  try {
    const client = await Client.create(signer, {
      env: XMTP_ENV,
      appVersion: "clam-chat/1.0",
    });

    // Detect if OPFS was cleared since last session. When OPFS is cleared,
    // Client.create() creates a new installation with no local message history.
    // Calling sendSyncRequest() asks any other installations (other browsers/devices)
    // to upload an encrypted archive so this installation can restore history.
    const storedId = localStorage.getItem(LOCAL_STORAGE_KEYS.installationId);
    const currentId = client.installationId;
    if (currentId && storedId !== currentId) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.installationId, currentId);
      // Fire and forget — if no other installations exist, this is a no-op.
      client.sendSyncRequest().catch(() => {});
    }

    return client;
  } catch (err) {
    // If we hit 10/10 installations, revoke all old ones and retry.
    if (err instanceof Error && err.message.includes("10/10 installations")) {
      console.warn("[clam-chat] Hit installation limit, revoking all old installations...");
      await revokeAllInstallations(signer, XMTP_ENV);
      const client = await Client.create(signer, {
        env: XMTP_ENV,
        appVersion: "clam-chat/1.0",
      });
      if (client.installationId) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.installationId, client.installationId);
      }
      return client;
    }
    throw err;
  }
}

async function revokeAllInstallations(
  signer: Signer,
  env: "dev" | "production" | "local"
): Promise<void> {
  const identifier = await signer.getIdentifier();
  const inboxId = await getInboxIdForIdentifier(identifier, env);
  if (!inboxId) throw new Error("No inbox found for this address");

  const inboxStates = await Client.fetchInboxStates([inboxId], env);
  const installationBytes = inboxStates[0].installations.map((i) => i.bytes);

  console.log(`[clam-chat] Revoking ${installationBytes.length} installations...`);
  await Client.revokeInstallations(signer, inboxId, installationBytes, env);
  console.log("[clam-chat] Installations revoked successfully");
}
