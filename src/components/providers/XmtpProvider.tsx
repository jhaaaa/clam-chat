import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Client } from "@xmtp/browser-sdk";
import { useChatStore } from "@/store/chatStore";
import { createXmtpClient } from "@/lib/xmtp";
import {
  createKeyPairSigner,
  createWalletSigner,
  loadPrivateKey,
} from "@/lib/signer";
import type { XmtpNetwork } from "@/lib/constants";
import { useDisconnect, useWalletClient } from "wagmi";

interface XmtpContextValue {
  client: Client | null;
  isLoading: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (network: XmtpNetwork) => Promise<void>;
}

const XmtpContext = createContext<XmtpContextValue>({
  client: null,
  isLoading: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  switchNetwork: async () => {},
});

export function useXmtp() {
  return useContext(XmtpContext);
}

export default function XmtpProvider({ children }: { children: ReactNode }) {
  const {
    authMethod,
    address,
    client,
    setClient,
    isClientLoading,
    setClientLoading,
    clientError,
    setClientError,
    network,
    setNetwork,
    clearAuth,
  } = useChatStore();

  const { data: walletClient, isLoading: isWalletClientLoading } =
    useWalletClient();
  const { disconnect: disconnectWagmi } = useDisconnect();
  const connectingRef = useRef(false);
  const disconnectedRef = useRef(false);

  const connect = useCallback(async () => {
    if (connectingRef.current || !authMethod || !address) return;
    connectingRef.current = true;
    disconnectedRef.current = false;
    setClientLoading(true);
    setClientError(null);

    try {
      let signer;

      if (authMethod === "key") {
        const privateKeyHex = loadPrivateKey();
        if (!privateKeyHex) throw new Error("No private key found");
        signer = createKeyPairSigner(privateKeyHex);
      } else if (authMethod === "wallet") {
        if (!walletClient) throw new Error("Wallet not connected");
        signer = createWalletSigner(address, (args) =>
          walletClient.signMessage({ message: args.message })
        );
      } else {
        throw new Error("Unknown auth method");
      }

      console.log("[clam-chat] Creating XMTP client...");
      const xmtpClient = await createXmtpClient(signer, network);
      console.log("[clam-chat] XMTP client created, inboxId:", xmtpClient.inboxId);
      // Don't update state if user disconnected while we were connecting
      if (!disconnectedRef.current) {
        setClient(xmtpClient);
      }
    } catch (err) {
      // Don't show errors if user disconnected while we were connecting
      if (!disconnectedRef.current) {
        const message =
          err instanceof Error ? err.message : "Failed to connect to XMTP";
        setClientError(message);
        console.error("[clam-chat] XMTP connection error:", err);
      }
    } finally {
      if (!disconnectedRef.current) {
        setClientLoading(false);
      }
      connectingRef.current = false;
    }
  }, [
    authMethod,
    address,
    walletClient,
    network,
    setClient,
    setClientLoading,
    setClientError,
  ]);

  const disconnect = useCallback(() => {
    // Signal any in-flight connect() to swallow its result
    disconnectedRef.current = true;
    connectingRef.current = false;
    // Close the XMTP client to release OPFS file handles and terminate workers
    if (client) {
      try { client.close(); } catch { /* best-effort */ }
    }
    setClient(null);
    clearAuth();
    // Also disconnect wagmi so it doesn't auto-reconnect on page reload
    disconnectWagmi();
  }, [client, setClient, clearAuth, disconnectWagmi]);

  const switchNetwork = useCallback(
    async (newNetwork: XmtpNetwork) => {
      setClient(null);
      setNetwork(newNetwork);
    },
    [setClient, setNetwork]
  );

  // Auto-connect when auth is set and we don't have a client
  useEffect(() => {
    if (!authMethod || !address || client || isClientLoading || clientError)
      return;

    // For wallet auth, wait until walletClient is done loading and available
    if (authMethod === "wallet") {
      if (isWalletClientLoading) {
        console.log("[clam-chat] Waiting for wallet client to load...");
        return;
      }
      if (!walletClient) {
        console.log("[clam-chat] Wallet client not available yet");
        return;
      }
    }

    console.log("[clam-chat] Auto-connecting with method:", authMethod);
    connect();
  }, [
    authMethod,
    address,
    client,
    isClientLoading,
    clientError,
    walletClient,
    isWalletClientLoading,
    connect,
  ]);

  return (
    <XmtpContext.Provider
      value={{
        client,
        isLoading: isClientLoading,
        error: clientError,
        connect,
        disconnect,
        switchNetwork,
      }}
    >
      {children}
    </XmtpContext.Provider>
  );
}
