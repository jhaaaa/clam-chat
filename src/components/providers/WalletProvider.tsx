import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected, metaMask, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "PLACEHOLDER";

const config = createConfig({
  connectors: [
    metaMask(),
    walletConnect({ projectId, showQrModal: true }),
    injected(),
  ],
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http("https://eth.llamarpc.com"),
    [sepolia.id]: http("https://rpc.ankr.com/eth_sepolia"),
  },
});

const queryClient = new QueryClient();

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
