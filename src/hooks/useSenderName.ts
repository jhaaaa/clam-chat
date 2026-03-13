import { useState, useEffect } from "react";
import { ensClient } from "@/lib/ens";

// In-memory cache shared across all components for the session
const nameCache = new Map<string, { label: string; sublabel: string }>();
const pendingLookups = new Map<string, Promise<{ label: string; sublabel: string }>>();

async function resolveInboxId(
  inboxId: string,
  getMembersForInbox: () => Promise<string | undefined>
): Promise<{ label: string; sublabel: string }> {
  const shortInbox = inboxId.slice(0, 6) + "..." + inboxId.slice(-4);
  const fallback = { label: shortInbox, sublabel: "" };

  try {
    const address = await getMembersForInbox();
    if (!address) return fallback;

    const shortAddr = address.slice(0, 6) + "..." + address.slice(-4);
    let result = { label: shortAddr, sublabel: "" };

    try {
      const ensName = await ensClient.getEnsName({ address: address as `0x${string}` });
      if (ensName) {
        result = { label: ensName, sublabel: shortAddr };
      }
    } catch {
      // ENS failed — short address is fine
    }

    return result;
  } catch {
    return fallback;
  }
}

export function useSenderName(
  inboxId: string,
  getAddress: () => Promise<string | undefined>
): { label: string; sublabel: string } {
  const [name, setName] = useState(() => {
    const cached = nameCache.get(inboxId);
    if (cached) return cached;
    const short = inboxId.slice(0, 6) + "..." + inboxId.slice(-4);
    return { label: short, sublabel: "" };
  });

  useEffect(() => {
    if (nameCache.has(inboxId)) {
      setName(nameCache.get(inboxId)!);
      return;
    }

    // Deduplicate concurrent lookups for the same inboxId
    if (!pendingLookups.has(inboxId)) {
      pendingLookups.set(
        inboxId,
        resolveInboxId(inboxId, getAddress).then((result) => {
          nameCache.set(inboxId, result);
          pendingLookups.delete(inboxId);
          return result;
        })
      );
    }

    let cancelled = false;
    pendingLookups.get(inboxId)!.then((result) => {
      if (!cancelled) setName(result);
    });

    return () => { cancelled = true; };
  }, [inboxId, getAddress]);

  return name;
}
