import { useConnect, useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";

interface ConnectWalletModalProps {
  onClose: () => void;
}

function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && !!(window as any).ethereum;
}

function hasMetaMask(): boolean {
  return hasInjectedWallet() && !!(window as any).ethereum.isMetaMask;
}

function isMobile(): boolean {
  return typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export default function ConnectWalletModal({ onClose }: ConnectWalletModalProps) {
  const { connectors, connect, isPending, isSuccess, error } = useConnect();
  const { address, isConnected } = useAccount();
  const { setAuth } = useChatStore();
  const [status, setStatus] = useState("");

  const useExistingConnection = () => {
    if (isConnected && address) {
      setAuth("wallet", address);
      onClose();
      return true;
    }
    return false;
  };

  // On mobile, auto-trigger WalletConnect (opens its own wallet picker)
  useEffect(() => {
    if (!isMobile()) return;
    if (useExistingConnection()) return;
    const wc = connectors.find((c) => c.id === "walletConnect");
    if (wc) {
      connect({ connector: wc });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close modal on successful connection
  useEffect(() => {
    if (isSuccess) {
      if (address) setAuth("wallet", address);
      onClose();
    }
  }, [isSuccess, address, setAuth, onClose]);

  // If connect fails because already connected, use the existing connection
  useEffect(() => {
    if (error?.message?.includes("already connected")) {
      useExistingConnection();
    }
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build wallet options for desktop
  const walletOptions: { id: string; label: string; icon: string }[] = [];
  const connectorIds = connectors.map((c) => c.id);

  if (connectorIds.includes("injected") && hasMetaMask()) {
    walletOptions.push({ id: "injected", label: "MetaMask", icon: "\u{1F98A}" });
  }

  if (connectorIds.includes("walletConnect")) {
    walletOptions.push({ id: "walletConnect", label: "WalletConnect", icon: "\u{1F517}" });
  }

  if (!hasMetaMask() && hasInjectedWallet() && connectorIds.includes("injected")) {
    walletOptions.push({ id: "injected", label: "Browser Wallet", icon: "\u{1F310}" });
  }

  const handleConnect = (id: string) => {
    if (useExistingConnection()) return;
    const connector = connectors.find((c) => c.id === id);
    if (!connector) return;
    setStatus("Connecting...");
    connect({ connector });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center" onClick={onClose}>
      <div
        className="w-full rounded-t-xl bg-white p-6 shadow-xl md:max-w-sm md:rounded-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-gray-100">Connect wallet</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        <div className="space-y-2">
          {walletOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleConnect(option.id)}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-xl border border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <span className="text-2xl">{option.icon}</span>
              <span className="font-medium">{option.label}</span>
            </button>
          ))}
        </div>

        {isPending && (
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Check your wallet...
          </p>
        )}
        {status && !isPending && !error && (
          <p className="mt-4 text-center text-sm text-gray-400 dark:text-gray-500">{status}</p>
        )}
        {error && !error.message.includes("already connected") && (
          <p className="mt-4 text-center text-sm text-red-600">{error.message}</p>
        )}
      </div>
    </div>
  );
}
