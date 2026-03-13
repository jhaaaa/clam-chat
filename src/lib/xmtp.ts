import { Client, ConsentState, type Signer } from "@xmtp/browser-sdk";
import type { XmtpNetwork } from "./constants";
import { XMTP_NETWORKS } from "./constants";

export async function createXmtpClient(
  signer: Signer,
  network: XmtpNetwork
): Promise<Client> {
  try {
    return await initClient(signer, network);
  } catch (err) {
    // If we hit the 10-installation limit, revoke all others and retry
    if (err instanceof Error && err.message.includes("10/10 installations")) {
      await revokeAndRetry(signer, network);
      return await initClient(signer, network);
    }
    throw err;
  }
}

async function initClient(signer: Signer, network: XmtpNetwork): Promise<Client> {
  const client = await Client.create(signer, {
    env: XMTP_NETWORKS[network].env,
    appVersion: "clam-chat/1.0",
  });

  await client.conversations.syncAll([ConsentState.Allowed]);
  return client;
}

async function revokeAndRetry(signer: Signer, network: XmtpNetwork): Promise<void> {
  // Create a client with auto-registration disabled so we can revoke first
  const client = await Client.create(signer, {
    env: XMTP_NETWORKS[network].env,
    appVersion: "clam-chat/1.0",
    disableAutoRegister: true,
  });
  await client.revokeAllOtherInstallations();
}
