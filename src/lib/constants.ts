export const XMTP_NETWORKS = {
  dev: { env: "dev" as const, label: "Developer Network" },
  production: { env: "production" as const, label: "Production Network" },
} as const;

export type XmtpNetwork = keyof typeof XMTP_NETWORKS;

export const DEFAULT_NETWORK: XmtpNetwork =
  process.env.NODE_ENV === "production" ? "production" : "dev";

export const LOCAL_STORAGE_KEYS = {
  privateKey: "hollachat-private-key",
  network: "hollachat-network",
} as const;
