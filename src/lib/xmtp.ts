import { Client, ConsentState, getInboxIdForIdentifier, type Signer } from "@xmtp/browser-sdk";
import type { XmtpNetwork } from "./constants";
import { XMTP_NETWORKS } from "./constants";

const MAX_INSTALLATIONS_BEFORE_CLEANUP = 9;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

export async function createXmtpClient(
  signer: Signer,
  network: XmtpNetwork
): Promise<Client> {
  const env = XMTP_NETWORKS[network].env;

  try {
    console.log("[clam-chat] Creating client...");
    const client = await Client.create(signer, {
      env,
      appVersion: "clam-chat/1.0",
    });
    console.log("[clam-chat] Client created successfully");

    // Proactively clean up stale installations in the background.
    // This requires a wallet signature, so we don't await it — otherwise
    // WalletConnect users would get a second sign prompt immediately.
    pruneInstallationsIfNeeded(client);

    console.log("[clam-chat] Syncing conversations...");
    await withTimeout(
      client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]),
      15_000,
      "Conversation sync timed out"
    );
    console.log("[clam-chat] Sync complete");
    return client;
  } catch (err) {
    // If we somehow still hit 10/10, use static revocation and retry
    if (err instanceof Error && err.message.includes("10/10 installations")) {
      console.log("[clam-chat] Hit installation limit, revoking all installations...");
      await revokeAllInstallations(signer, env);
      const client = await Client.create(signer, {
        env,
        appVersion: "clam-chat/1.0",
      });
      await client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]);
      return client;
    }
    throw err;
  }
}

async function pruneInstallationsIfNeeded(client: Client): Promise<void> {
  try {
    const inboxState = await client.preferences.fetchInboxState();
    const count = inboxState.installations.length;
    if (count >= MAX_INSTALLATIONS_BEFORE_CLEANUP) {
      console.log(`[clam-chat] ${count} installations found, revoking stale ones...`);
      await client.revokeAllOtherInstallations();
      console.log("[clam-chat] Stale installations revoked");
    }
  } catch (err) {
    // Don't block login if cleanup fails
    console.warn("[clam-chat] Failed to prune installations:", err);
  }
}

async function revokeAllInstallations(
  signer: Signer,
  env: "dev" | "production" | "local"
): Promise<void> {
  // Static methods — no Client instance needed, so the 10/10 limit can't block us
  const identifier = await signer.getIdentifier();
  const inboxId = await getInboxIdForIdentifier(identifier, env);
  if (!inboxId) throw new Error("No inbox found for this address");

  const inboxStates = await Client.fetchInboxStates([inboxId], env);
  const installationBytes = inboxStates[0].installations.map((i) => i.bytes);

  console.log(`[clam-chat] Revoking ${installationBytes.length} installations...`);
  await Client.revokeInstallations(signer, inboxId, installationBytes, env);
  console.log("[clam-chat] Installations revoked successfully");
}
