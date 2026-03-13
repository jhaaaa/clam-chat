import { useState, useEffect, useCallback } from "react";

export default function MultiTabWarning() {
  const [blocked, setBlocked] = useState(false);

  const handleUseThisTab = useCallback(() => {
    const ch = new BroadcastChannel("hollachat-tab");
    ch.postMessage("yield");
    ch.close();
    setBlocked(false);
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel("hollachat-tab");

    const onMessage = (e: MessageEvent) => {
      if (e.data === "ping") {
        // Another tab just opened — it will see our pong and know we exist
        channel.postMessage("pong");
      } else if (e.data === "pong") {
        // We pinged and got a response — another tab is already active
        setBlocked(true);
      } else if (e.data === "yield") {
        // The other tab clicked "Use This Tab", so we should block
        setBlocked(true);
      }
    };

    channel.addEventListener("message", onMessage);

    // Announce ourselves — any existing tab will respond with "pong"
    channel.postMessage("ping");

    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, []);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white">
      <div className="mx-4 max-w-md text-center">
        <h2 className="text-xl font-bold text-gray-900">
          Clam Chat is open in another tab
        </h2>
        <p className="mt-3 text-sm text-gray-600">
          Close the other tab to continue here, or use that tab instead.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          XMTP can only run in one tab at a time.
        </p>
        <button
          onClick={handleUseThisTab}
          className="mt-6 rounded-lg bg-black px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Use this tab
        </button>
      </div>
    </div>
  );
}
