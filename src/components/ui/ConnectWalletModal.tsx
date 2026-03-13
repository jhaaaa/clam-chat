import { useConnect } from "wagmi";
import { useEffect } from "react";

interface ConnectWalletModalProps {
  onClose: () => void;
}

// Check if MetaMask extension is installed
function hasMetaMask(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum?.isMetaMask;
}

interface WalletOption {
  id: string;
  label: string;
  icon: string;
  closesModal: boolean;
}

function getWalletOptions(connectorIds: string[]): WalletOption[] {
  const options: WalletOption[] = [];

  // If MetaMask is installed, show it via the injected connector
  if (connectorIds.includes("injected") && hasMetaMask()) {
    options.push({
      id: "injected",
      label: "MetaMask",
      icon: "\u{1F98A}",
      closesModal: false,
    });
  }

  // Always show WalletConnect — works with any mobile wallet
  if (connectorIds.includes("walletConnect")) {
    options.push({
      id: "walletConnect",
      label: "WalletConnect",
      icon: "\u{1F517}",
      closesModal: true, // Close our modal so the QR overlay can appear
    });
  }

  // If no MetaMask but there's an injected wallet, show it generically
  if (!hasMetaMask() && connectorIds.includes("injected")) {
    options.push({
      id: "injected",
      label: "Browser Wallet",
      icon: "\u{1F310}",
      closesModal: false,
    });
  }

  return options;
}

export default function ConnectWalletModal({ onClose }: ConnectWalletModalProps) {
  const { connectors, connect, isPending, isSuccess } = useConnect();

  // Close modal on successful connection
  useEffect(() => {
    if (isSuccess) onClose();
  }, [isSuccess, onClose]);

  const connectorIds = connectors.map((c) => c.id);
  const walletOptions = getWalletOptions(connectorIds);

  const handleConnect = (option: WalletOption) => {
    const connector = connectors.find((c) => c.id === option.id);
    if (!connector) return;
    if (option.closesModal) onClose();
    connect({ connector });
  };

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
          {walletOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleConnect(option)}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <span className="text-2xl">{option.icon}</span>
              <span className="font-medium">{option.label}</span>
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
