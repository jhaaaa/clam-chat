# CLAUDE.md

## Project
Clam Chat (clam.chat) — encrypted messaging web app using XMTP v3 browser SDK.

## Key commands
- `npm run dev` — start Vite dev server (serves COOP/COEP headers)
- `npm run build` — TypeScript check + Vite production build
- `npm run preview` — preview production build

## Architecture
- Vite + React + TypeScript (NOT Next.js — the XMTP browser SDK's WASM workers don't work with Next.js/Turbopack)
- React Router for client-side routing
- @xmtp/browser-sdk for messaging (NOT the deprecated @xmtp/xmtp-js)
- Browser SDK has built-in send methods (sendText, sendReaction, sendReply,
  sendRemoteAttachment) — no separate @xmtp/content-type-* packages needed
- wagmi + viem for wallet connection (custom connect modal, no RainbowKit)
- @noble/curves + @noble/hashes for key-pair-based auth (no wallet needed)
- Zustand for client-side state
- Tailwind CSS v4 for styling

## Important
- XMTP browser SDK requires COOP/COEP headers (set in vite.config.ts)
- Only one browser tab can use the SDK at a time (OPFS limitation)
- dbEncryptionKey is NOT used in browser environments — do not generate one
- Use XMTP v3 APIs only — v2 is deprecated
- Use the XMTP docs MCP server to look up exact API signatures before coding
- Always call syncAll() after client creation and periodically
- Always filter conversations by consentStates (Allowed, Unknown, Denied)
- Construct Signer objects manually — there is no createEOASigner helper
- Use built-in send methods (sendText, sendReaction, etc.) not generic send()
- Noble v2 uses .js extensions in imports and randomSecretKey() (not randomPrivateKey)

## Network
- Dev network for development/testing
- Production network for production builds
- Network is switchable at runtime via UI toggle
