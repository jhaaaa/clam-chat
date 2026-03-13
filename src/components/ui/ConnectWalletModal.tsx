import { useConnect } from "wagmi";
import { useEffect } from "react";

interface ConnectWalletModalProps {
  onClose: () => void;
}

function connectorLabel(id: string, name: string): string | null {
  if (id === "metaMaskSDK" || id === "metaMask") return "MetaMask";
  if (id === "walletConnect") return "WalletConnect";
  if (id === "injected" && name !== "MetaMask") return name || "Browser Wallet";
  // Skip duplicate injected MetaMask entry
  return null;
}

function connectorIcon(id: string): string {
  if (id === "metaMaskSDK" || id === "metaMask") return "\u{1F98A}";
  if (id === "walletConnect") return "\u{1F517}";
  return "\u{1F310}";
}

export default function ConnectWalletModal({ onClose }: ConnectWalletModalProps) {
  const { connectors, connect, isPending, isSuccess } = useConnect();

  // Close modal on successful connection
  useEffect(() => {
    if (isSuccess) onClose();
  }, [isSuccess, onClose]);

  // Deduplicate connectors by label
  const seen = new Set<string>();
  const walletOptions = connectors
    .map((connector) => {
      const label = connectorLabel(connector.id, connector.name);
      if (!label || seen.has(label)) return null;
      seen.add(label);
      return { connector, label, icon: connectorIcon(connector.id) };
    })
    .filter(Boolean) as { connector: (typeof connectors)[number]; label: string; icon: string }[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect wallet</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {walletOptions.map(({ connector, label, icon }) => (
            <button
              key={connector.id}
              onClick={() => connect({ connector })}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <span className="text-2xl">{icon}</span>
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>

        {isPending && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Check your wallet...
          </p>
        )}
      </div>
    </div>
  );
}
