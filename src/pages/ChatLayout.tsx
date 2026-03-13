import { useState, useEffect, useRef } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useXmtp } from "@/components/providers/XmtpProvider";
import { useChatStore } from "@/store/chatStore";
import { loadPrivateKey } from "@/lib/signer";
import MultiTabWarning from "@/components/ui/MultiTabWarning";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import AddressAvatar from "@/components/ui/AddressAvatar";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import ConversationList from "@/components/chat/ConversationList";

export default function ChatLayout() {
  const navigate = useNavigate();
  const { client, isLoading, disconnect } = useXmtp();
  const { address, authMethod, selectedConversation } = useChatStore();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [copiedItem, setCopiedItem] = useState<"key" | "address" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Redirect to landing if not connected
  useEffect(() => {
    if (!client && !isLoading) {
      navigate("/");
    }
  }, [client, isLoading, navigate]);

  // Close menu on outside click
  useEffect(() => {
    if (!showAccountMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAccountMenu]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Connecting to XMTP..." />
      </div>
    );
  }

  if (!client) return null;

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const handleCopy = async (type: "key" | "address") => {
    const text = type === "key" ? loadPrivateKey() : address;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedItem(type);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className="flex h-screen flex-col">
      <MultiTabWarning />
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-2 py-2 md:px-4 md:py-3 dark:border-gray-700">
        <h1 className="text-base font-bold md:text-lg">Clam Chat</h1>
        <div className="relative flex items-center gap-3" ref={menuRef}>
          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="rounded-full p-0.5 transition-opacity hover:opacity-80"
            title={address || ""}
          >
            {address ? (
              <AddressAvatar address={address} size={34} />
            ) : (
              <div className="h-[34px] w-[34px] rounded-full bg-gray-200 dark:bg-gray-700" />
            )}
          </button>

          {/* Account dropdown menu */}
          {showAccountMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
              {/* Avatar + Address */}
              <div className="flex items-center gap-3">
                {address && <AddressAvatar address={address} size={40} />}
                <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                  {shortAddress}
                </p>
              </div>

              <div className="my-3 h-px bg-gray-100 dark:bg-gray-700" />

              {/* Copy your address — for sharing with others */}
              <button
                onClick={() => handleCopy("address")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <span className="text-base">
                  {copiedItem === "address" ? "\u2713" : "\u{1F4CB}"}
                </span>
                <span>
                  {copiedItem === "address"
                    ? "Copied to clipboard!"
                    : "Copy your address"}
                </span>
              </button>
              <p className="mt-1 px-3 text-xs text-gray-500 dark:text-gray-500">
                Share this so others can message you.
              </p>

              {/* Copy account key — only for key pair auth */}
              {authMethod === "key" && (
                <>
                  <button
                    onClick={() => handleCopy("key")}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <span className="text-base">
                      {copiedItem === "key" ? "\u2713" : "\u{1F511}"}
                    </span>
                    <span>
                      {copiedItem === "key"
                        ? "Copied to clipboard!"
                        : "Copy account key"}
                    </span>
                  </button>
                  <p className="mt-1 px-3 text-xs text-gray-500 dark:text-gray-500">
                    Use this key to sign in on another device or browser.
                  </p>
                </>
              )}

              <div className="my-3 h-px bg-gray-100 dark:bg-gray-700" />

              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Appearance</span>
                <DarkModeToggle />
              </div>

              <div className="my-3 h-px bg-gray-100 dark:bg-gray-700" />

              <button
                onClick={() => {
                  setShowAccountMenu(false);
                  disconnect();
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} h-full w-full flex-col border-r border-gray-200 bg-white md:w-80 dark:border-gray-700 dark:bg-gray-900`}>
          <ConversationList />
        </div>
        <div className={`${!selectedConversation ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
