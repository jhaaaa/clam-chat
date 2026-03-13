import { useChatStore } from "@/store/chatStore";
import { XMTP_NETWORKS, type XmtpNetwork } from "@/lib/constants";
import { useXmtp } from "@/components/providers/XmtpProvider";

export default function NetworkSwitch() {
  const { network } = useChatStore();
  const { switchNetwork } = useXmtp();

  const handleSwitch = async (newNetwork: XmtpNetwork) => {
    if (newNetwork === network) return;

    const label = newNetwork === "production" ? "Prod" : "Dev";
    const confirmed = window.confirm(
      `Switch to ${label} network? Dev and Prod are completely separate networks and do not share data.`
    );
    if (!confirmed) return;

    await switchNetwork(newNetwork);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg bg-gray-100 p-0.5">
        {(Object.keys(XMTP_NETWORKS) as XmtpNetwork[]).map((key) => (
          <button
            key={key}
            onClick={() => handleSwitch(key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              network === key
                ? "bg-indigo-500 text-white"
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
