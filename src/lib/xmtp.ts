import { Client, ConsentState, getInboxIdForIdentifier, type Signer } from "@xmtp/browser-sdk";
import type { XmtpNetwork } from "./constants";
import { XMTP_NETWORKS } from "./constants";

const MAX_INSTALLATIONS_BEFORE_CLEANUP = 9;

export async function createXmtpClient(
  signer: Signer,
  network: XmtpNetwork
): Promise<Client> {
  const env = XMTP_NETWORKS[network].env;

  try {
    const client = await Client.create(signer, {
      env,
      appVersion: "clam-chat/1.0",
    });

    // Proactively clean up stale installations before hitting the 10/10 hard limit
    await pruneInstallationsIfNeeded(client);

    await client.conversations.syncAll([ConsentState.Allowed]);
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
      await client.conversations.syncAll([ConsentState.Allowed]);
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
