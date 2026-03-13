import { Client, ConsentState, type Signer } from "@xmtp/browser-sdk";
import type { XmtpNetwork } from "./constants";
import { XMTP_NETWORKS } from "./constants";

export async function createXmtpClient(
  signer: Signer,
  network: XmtpNetwork
): Promise<Client> {
  const client = await Client.create(signer, {
    env: XMTP_NETWORKS[network].env,
    appVersion: "hollachat/1.0",
  });

  // Sync all conversations, messages, and preferences from the network
  await client.conversations.syncAll([ConsentState.Allowed]);

  return client;
}
