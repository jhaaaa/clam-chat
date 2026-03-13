import { createPublicClient, http, fallback } from "viem";
import { mainnet } from "viem/chains";

const customRpc = import.meta.env.VITE_ETH_RPC_URL;

const transports = customRpc
  ? [http(customRpc)]
  : [
      http("https://cloudflare-eth.com"),
      http("https://ethereum-rpc.publicnode.com"),
      http("https://rpc.ankr.com/eth"),
      http("https://eth.llamarpc.com"),
    ];

export const ensClient = createPublicClient({
  chain: mainnet,
  transport: fallback(transports),
});
