# Clam Chat

End-to-end encrypted messaging built on [XMTP v3](https://docs.xmtp.org/).

Uses Ethereum wallet addresses as identities — no accounts, no servers, no tracking. Messages are encrypted with the MLS protocol and delivered through the XMTP network.

**Live at [clam.chat](https://clam.chat)**

## Features

- **DMs and group chats** — create 1-to-1 conversations or groups with multiple members
- **Reactions and replies** — emoji reactions on any message, threaded replies
- **File attachments** — small files sent inline, large files encrypted and pinned to IPFS via Pinata
- **ENS support** — resolve `.eth` names when starting conversations
- **Message requests** — inbox/requests split based on consent state, accept or block unknown senders
- **Real-time streaming** — messages, reactions, and new conversations arrive instantly
- **Dark mode** — system-aware with manual toggle
- **Two sign-in methods:**
  - **Connect wallet** — MetaMask, WalletConnect, or any injected wallet
  - **Key pair** — generate or import a private key (useful for dev/testing)

## Quick start

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` with the required COOP/COEP headers for XMTP's WASM module.

## Environment variables

Copy `.env.example` to `.env` and fill in what you need:

```
# Required for remote attachments (files > 1MB) to work cross-device
VITE_PINATA_JWT=          # from https://app.pinata.cloud/
VITE_PINATA_GATEWAY=      # e.g. your-gateway.mypinata.cloud

# Optional — needed for "Connect wallet" sign-in
VITE_WALLETCONNECT_PROJECT_ID=   # from https://cloud.walletconnect.com/

# Optional — custom Ethereum RPC for ENS resolution
VITE_ETH_RPC_URL=         # defaults to public RPCs
```

Without Pinata credentials, small file attachments (< 1MB) still work — they're sent inline. Key pair sign-in works without any env vars.

## Tech stack

- **Vite** + **React 19** + **TypeScript**
- **@xmtp/browser-sdk** — XMTP v3 messaging (MLS protocol, WASM)
- **wagmi** + **viem** — wallet connection and Ethereum RPC
- **Tailwind CSS v4** — styling
- **Zustand** — state management
- **@noble/curves** + **@noble/hashes** — key generation for dev sign-in

## Project structure

```
src/
├── components/
│   ├── chat/           # ConversationList, MessageList, MessageBubble, etc.
│   ├── conversations/  # ConsentBanner
│   ├── providers/      # XmtpProvider, WalletProvider
│   └── ui/             # AddressAvatar, DarkModeToggle, LoadingSpinner, etc.
├── hooks/              # useConversations, useMessages, useSenderName
├── lib/                # xmtp client, signer adapters, attachments, ENS
├── pages/              # LandingPage, ChatLayout, ChatPage
└── store/              # Zustand store
```

## Deployment

Deployed on Vercel. The `vercel.json` sets the required headers:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`
- `Content-Security-Policy` with `wasm-unsafe-eval`

These are mandatory — XMTP's browser SDK uses SharedArrayBuffer, which requires cross-origin isolation.

## Constraints

- **Single tab only** — XMTP uses OPFS + SQLite for local storage, which doesn't support concurrent access. The app detects and warns about multiple tabs.
- **COOP/COEP headers required** — without them, the WASM module won't load.
- **Installation limit** — XMTP allows up to 10 installations (browser sessions) per identity. The app auto-prunes stale installations to stay under the limit.

## Developer tools

The account menu has a hidden "Danger zone" section for managing XMTP installations (revoking stale sessions, resetting identity). To enable it:

```js
// Run in browser console
localStorage.setItem('clam-debug', '1')
```

Then reopen the account menu. To hide it again:

```js
localStorage.removeItem('clam-debug')
```

## License

ISC
