import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { Signer, Identifier } from "@xmtp/browser-sdk";
import { IdentifierKind } from "@xmtp/browser-sdk";
import { LOCAL_STORAGE_KEYS } from "./constants";

/**
 * Derive an Ethereum address from a secp256k1 public key.
 * address = 0x + last 20 bytes of keccak256(uncompressedPublicKey[1:])
 */
function publicKeyToAddress(publicKey: Uint8Array): string {
  // Remove the 0x04 prefix from uncompressed key, then hash
  const hash = keccak_256(publicKey.slice(1));
  const addressBytes = hash.slice(-20);
  return "0x" + bytesToHex(addressBytes);
}

/**
 * Sign a message using EIP-191 personal_sign scheme.
 * This replicates what MetaMask/wallets do with personal_sign:
 *   hash = keccak256("\x19Ethereum Signed Message:\n" + len + message)
 *   signature = secp256k1.sign(hash, privateKey)
 *   return r (32 bytes) + s (32 bytes) + v (1 byte)
 */
function eip191Sign(message: string, privateKey: Uint8Array): Uint8Array {
  const prefix = `\x19Ethereum Signed Message:\n${message.length}`;
  const prefixedMessage = new TextEncoder().encode(prefix + message);
  const hash = keccak_256(prefixedMessage);

  // noble v2: 'recovered' format = 65 bytes: recovery(1) + r(32) + s(32)
  // Ethereum expects: r(32) + s(32) + v(1) where v = recovery + 27
  const sig = secp256k1.sign(hash, privateKey, {
    prehash: false,
    format: "recovered",
  });

  const result = new Uint8Array(65);
  result.set(sig.slice(1), 0);   // r + s → bytes 0..63
  result[64] = sig[0] + 27;      // v = recovery + 27 (27 or 28)
  return result;
}

/**
 * Generate a new random private key and persist it to localStorage.
 * Returns the hex-encoded private key (without 0x prefix).
 */
export function generatePrivateKey(): string {
  const privateKeyBytes = secp256k1.utils.randomSecretKey();
  const hex = bytesToHex(privateKeyBytes);
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_KEYS.privateKey, hex);
  }
  return hex;
}

/**
 * Load a previously saved private key from localStorage.
 * Returns null if none exists.
 */
export function loadPrivateKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LOCAL_STORAGE_KEYS.privateKey);
}

/**
 * Save an imported private key to localStorage.
 * Validates that it's a valid secp256k1 key.
 */
export function importPrivateKey(hex: string): string {
  // Strip 0x prefix if present
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  // Validate by attempting to derive public key
  const bytes = hexToBytes(clean);
  secp256k1.getPublicKey(bytes, false); // throws if invalid
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_STORAGE_KEYS.privateKey, clean);
  }
  return clean;
}

/**
 * Get the Ethereum address for a private key hex string.
 */
export function getAddressFromPrivateKey(privateKeyHex: string): string {
  const bytes = hexToBytes(privateKeyHex);
  const publicKey = secp256k1.getPublicKey(bytes, false); // uncompressed
  return publicKeyToAddress(publicKey);
}

/**
 * Create an XMTP Signer from a locally stored private key.
 */
export function createKeyPairSigner(privateKeyHex: string): Signer {
  const privateKeyBytes = hexToBytes(privateKeyHex);
  const publicKey = secp256k1.getPublicKey(privateKeyBytes, false);
  const address = publicKeyToAddress(publicKey);

  const identifier: Identifier = {
    identifier: address,
    identifierKind: IdentifierKind.Ethereum,
  };

  return {
    type: "EOA",
    getIdentifier: () => identifier,
    signMessage: async (message: string) => {
      return eip191Sign(message, privateKeyBytes);
    },
  };
}

/**
 * Create an XMTP Signer from a wagmi wallet client.
 * Bridges walletClient.signMessage (returns hex string) to the
 * Uint8Array that XMTP expects.
 */
export function createWalletSigner(
  address: string,
  signMessageFn: (args: { message: string }) => Promise<string>
): Signer {
  const identifier: Identifier = {
    identifier: address,
    identifierKind: IdentifierKind.Ethereum,
  };

  return {
    type: "EOA",
    getIdentifier: () => identifier,
    signMessage: async (message: string) => {
      const hexSignature = await signMessageFn({ message });
      // Convert hex string (0x...) to Uint8Array
      const clean = hexSignature.startsWith("0x")
        ? hexSignature.slice(2)
        : hexSignature;
      return hexToBytes(clean);
    },
  };
}
