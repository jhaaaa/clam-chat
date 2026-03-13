import { useChatStore } from "@/store/chatStore";
import { XMTP_NETWORKS, type XmtpNetwork } from "@/lib/constants";
import { useXmtp } from "@/components/providers/XmtpProvider";

export default function NetworkSwitch() {
  const { network } = useChatStore();
  const { switchNetwork, client } = useXmtp();

  const handleSwitch = async (newNetwork: XmtpNetwork) => {
    if (newNetwork === network) return;

    if (newNetwork === "production") {
      const confirmed = window.confirm(
        "Switch to Production network? Dev and Production are completely separate networks with separate inboxes and identities."
      );
      if (!confirmed) return;
    }

    await switchNetwork(newNetwork);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Network:</span>
      <div className="flex rounded-lg bg-gray-100 p-0.5">
        {(Object.keys(XMTP_NETWORKS) as XmtpNetwork[]).map((key) => (
          <button
            key={key}
            onClick={() => handleSwitch(key)}
            disabled={!client && key !== network}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              network === key
                ? key === "production"
                  ? "bg-red-500 text-white"
                  : "bg-indigo-500 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {key === "dev" ? "Dev" : "Prod"}
          </button>
        ))}
      </div>
    </div>
  );
}
