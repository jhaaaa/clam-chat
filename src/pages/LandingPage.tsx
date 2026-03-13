import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import ConnectWalletModal from "@/components/ui/ConnectWalletModal";
import { useChatStore } from "@/store/chatStore";
import { useXmtp } from "@/components/providers/XmtpProvider";
import {
  generatePrivateKey,
  loadPrivateKey,
  importPrivateKey,
  getAddressFromPrivateKey,
} from "@/lib/signer";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import NetworkSwitch from "@/components/ui/NetworkSwitch";

export default function LandingPage() {
  const navigate = useNavigate();
  const { address: walletAddress, isConnected, isReconnecting } = useAccount();
  const { setAuth, authMethod } = useChatStore();
  const { client, isLoading, error } = useXmtp();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [importError, setImportError] = useState("");

  const hasSavedKey = loadPrivateKey() !== null;

  // Redirect to /chat once XMTP client is connected
  useEffect(() => {
    if (client) {
      navigate("/chat");
    }
  }, [client, navigate]);

  // Track previous isConnected to detect fresh connections (false → true)
  const wasConnected = useRef(isConnected);
  useEffect(() => {
    const justConnected = isConnected && !wasConnected.current;
    wasConnected.current = isConnected;

    if (justConnected && !isReconnecting && walletAddress && !authMethod) {
      setAuth("wallet", walletAddress);
    }
  }, [isConnected, isReconnecting, walletAddress, authMethod, setAuth]);

  const connectWithKey = (key: string) => {
    const address = getAddressFromPrivateKey(key);
    setAuth("key", address);
  };

  const handleSignIn = () => {
    const key = loadPrivateKey();
    if (key) {
      connectWithKey(key);
    }
  };

  const handleCreateAccount = () => {
    if (hasSavedKey) {
      const confirmed = window.confirm(
        "This will replace your current account in this browser.\n\n" +
        "To save your current account key: Sign in, click your avatar in the top right, " +
        "and select \"Copy account key\".\n\n" +
        "Replace your account?"
      );
      if (!confirmed) return;
    }
    const key = generatePrivateKey();
    connectWithKey(key);
  };

  const handleImportKey = () => {
    setImportError("");
    try {
      const key = importPrivateKey(importValue.trim());
      connectWithKey(key);
    } catch {
      setImportError("Invalid key. Please check and try again.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <img src="/clam.svg" alt="" className="mx-auto h-16 w-16" />
          <h1 className="text-4xl font-bold tracking-tight">Clam Chat</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Encrypted messaging powered by XMTP
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-8 dark:border-gray-700 dark:bg-gray-800">
            <LoadingSpinner size="lg" label="Signing you in..." />
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Your wallet may ask you to sign a message. This authorizes this browser to send and receive messages on your behalf. It does not cost gas or move any funds.
            </p>
          </div>
        )}

        {/* Error state — only show if the user is actively trying to connect */}
        {error && authMethod && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Auth options — hidden when loading or connected */}
        {!isLoading && !client && (
          <div className="space-y-4">
            {/* Primary action */}
            <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
              <p className="mb-2 text-lg font-medium">
                {hasSavedKey ? "Welcome back" : "Create an account"}
              </p>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                {hasSavedKey
                  ? "Sign in with the account saved in this browser."
                  : "No wallet needed. We'll create an account that lives in your browser."}
              </p>
              <button
                onClick={hasSavedKey ? handleSignIn : handleCreateAccount}
                className="btn-rainbow w-full"
              >
                {hasSavedKey ? "Sign in" : "Get started"}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-sm text-gray-400 dark:text-gray-500">or</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Wallet auth */}
            <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-700">
              <p className="mb-4 text-lg font-medium">Connect a wallet</p>
              <button
                onClick={() => setShowWalletModal(true)}
                className="btn-rainbow w-full"
              >
                Connect wallet
              </button>
            </div>

            {/* Advanced options */}
            <div className="text-center">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                {showAdvanced ? "Hide advanced options" : "Advanced options"}
              </button>
            </div>

            {showAdvanced && (
              <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50">
                {/* Network switch */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Network</span>
                  <NetworkSwitch />
                </div>

                <div className="h-px bg-gray-200 dark:bg-gray-700" />

                {/* Create another account */}
                {hasSavedKey && (
                  <button
                    onClick={handleCreateAccount}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    Create another account
                  </button>
                )}

                {/* Import key */}
                <button
                  onClick={() => setShowImport(!showImport)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {showImport ? "Cancel import" : "I have an account on another device"}
                </button>

                {showImport && (
                  <div className="space-y-2 pl-3">
                    <input
                      type="password"
                      value={importValue}
                      onChange={(e) => setImportValue(e.target.value)}
                      placeholder="Paste your account key"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    {importError && (
                      <p className="text-xs text-red-600">{importError}</p>
                    )}
                    <button
                      onClick={handleImportKey}
                      disabled={!importValue.trim()}
                      className="w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:opacity-50 dark:bg-gray-600 dark:hover:bg-gray-500"
                    >
                      Sign In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showWalletModal && (
        <ConnectWalletModal onClose={() => setShowWalletModal(false)} />
      )}
    </div>
  );
}
