import { useState } from "react";
import { IdentifierKind, type Conversation } from "@xmtp/browser-sdk";
import { isAddress } from "viem";
import { normalize } from "viem/ens";
import { useXmtp } from "@/components/providers/XmtpProvider";
import { ensClient } from "@/lib/ens";

interface NewConversationDialogProps {
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}

export default function NewConversationDialog({
  onClose,
  onCreated,
}: NewConversationDialogProps) {
  const { client } = useXmtp();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!client || !input.trim()) return;

    const value = input.trim();
    setError("");
    setIsCreating(true);

    try {
      let resolvedAddress: string;

      // Check if it's an ENS name
      if (value.endsWith(".eth") || value.includes(".")) {
        setStatus("Resolving ENS name...");
        try {
          const ensAddress = await ensClient.getEnsAddress({
            name: normalize(value),
          });
          if (!ensAddress) {
            setError(`Could not resolve "${value}". No address found for this ENS name.`);
            setIsCreating(false);
            setStatus("");
            return;
          }
          resolvedAddress = ensAddress.toLowerCase();
          setStatus(`Resolved to ${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`);
        } catch {
          setError(`Could not resolve "${value}". Make sure it's a valid ENS name.`);
          setIsCreating(false);
          setStatus("");
          return;
        }
      } else if (isAddress(value)) {
        resolvedAddress = value.toLowerCase();
      } else {
        setError("Enter a valid Ethereum address (0x...) or ENS name (e.g. alice.eth)");
        setIsCreating(false);
        return;
      }

      // Check if the address is reachable on XMTP
      setStatus("Checking XMTP identity...");
      const identifier = {
        identifier: resolvedAddress,
        identifierKind: IdentifierKind.Ethereum,
      };
      const canMessageResult = await client.canMessage([identifier]);
      const isReachable = canMessageResult.get(resolvedAddress);

      if (!isReachable) {
        setError(
          "This address isn't on XMTP yet. They need to create an XMTP identity first."
        );
        setIsCreating(false);
        setStatus("");
        return;
      }

      // Create the DM
      setStatus("Starting conversation...");
      let dm;
      try {
        dm = await client.conversations.createDmWithIdentifier(identifier);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("synced") && msg.includes("succeeded")) {
          console.log("[clam-chat] DM created (sync noise):", msg);
          onClose();
          return;
        }
        throw err;
      }

      onCreated(dm);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create conversation";
      setError(message);
      console.error("[clam-chat] Failed to create conversation:", err);
    } finally {
      setIsCreating(false);
      setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:px-4">
      <div className="w-full max-h-[90dvh] overflow-y-auto rounded-t-xl bg-white p-6 shadow-xl md:mb-0 md:max-w-md md:rounded-xl dark:bg-gray-800">
        <h2 className="mb-1 text-lg font-semibold dark:text-gray-100">New DM</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Enter an address or ENS name to start a conversation.
        </p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="0x... or name.eth"
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
        />

        {status && !error && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{status}</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!input.trim() || isCreating}
            className="btn-rainbow px-4 py-2 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Start chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
