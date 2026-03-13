import { useState } from "react";
import { IdentifierKind, type Conversation, type Identifier } from "@xmtp/browser-sdk";
import { isAddress } from "viem";
import { normalize } from "viem/ens";
import { useXmtp } from "@/components/providers/XmtpProvider";
import { ensClient } from "@/lib/ens";

interface NewGroupDialogProps {
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}

interface PendingMember {
  address: string;
  displayLabel: string;
}

export default function NewGroupDialog({
  onClose,
  onCreated,
}: NewGroupDialogProps) {
  const { client } = useXmtp();
  const [groupName, setGroupName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resolveAddress = async (
    value: string
  ): Promise<{ address: string; label: string } | null> => {
    if (value.endsWith(".eth") || value.includes(".")) {
      setStatus("Resolving ENS name...");
      try {
        const ensAddress = await ensClient.getEnsAddress({
          name: normalize(value),
        });
        if (!ensAddress) {
          setError(`Could not resolve "${value}".`);
          return null;
        }
        return { address: ensAddress.toLowerCase(), label: value };
      } catch {
        setError(`Could not resolve "${value}".`);
        return null;
      }
    } else if (isAddress(value)) {
      return { address: value.toLowerCase(), label: value };
    } else {
      setError("Enter a valid Ethereum address or ENS name.");
      return null;
    }
  };

  const handleAddMember = async () => {
    const value = memberInput.trim();
    if (!value || !client) return;
    setError("");

    const resolved = await resolveAddress(value);
    setStatus("");
    if (!resolved) return;

    if (members.some((m) => m.address === resolved.address)) {
      setError("Already added.");
      return;
    }

    setMembers((prev) => [
      ...prev,
      { address: resolved.address, displayLabel: resolved.label },
    ]);
    setMemberInput("");
  };

  const handleRemoveMember = (address: string) => {
    setMembers((prev) => prev.filter((m) => m.address !== address));
  };

  const handleCreate = async () => {
    if (!client || !groupName.trim() || members.length === 0) return;
    setError("");
    setIsCreating(true);
    setStatus("Checking XMTP identities...");

    try {
      const identifiers: Identifier[] = members.map((m) => ({
        identifier: m.address,
        identifierKind: IdentifierKind.Ethereum,
      }));

      // Verify all members are on XMTP
      const canMessageResult = await client.canMessage(identifiers);
      const unreachable = members.filter(
        (m) => !canMessageResult.get(m.address)
      );
      if (unreachable.length > 0) {
        setError(
          `Not on XMTP: ${unreachable.map((m) => m.displayLabel).join(", ")}`
        );
        setIsCreating(false);
        setStatus("");
        return;
      }

      setStatus("Creating group...");
      const group = await client.conversations.createGroupWithIdentifiers(
        identifiers,
        { groupName: groupName.trim() }
      );

      onCreated(group);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create group";
      setError(message);
      console.error("[hollachat] Failed to create group:", err);
    } finally {
      setIsCreating(false);
      setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h2 className="mb-1 text-lg font-semibold dark:text-gray-100">New group</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Give your group a name and add members.
        </p>

        {/* Group name */}
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name"
          autoFocus
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
        />

        {/* Add member input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
            placeholder="0x... or name.eth"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <button
            onClick={handleAddMember}
            disabled={!memberInput.trim()}
            className="shrink-0 rounded-lg bg-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Add
          </button>
        </div>

        {/* Member list */}
        {members.length > 0 && (
          <div className="mt-3 space-y-1">
            {members.map((m) => (
              <div
                key={m.address}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 dark:bg-gray-700"
              >
                <span className="truncate text-sm text-gray-600 dark:text-gray-300">
                  {m.displayLabel}
                </span>
                <button
                  onClick={() => handleRemoveMember(m.address)}
                  className="ml-2 shrink-0 text-xs text-gray-400 hover:text-red-500"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {status && !error && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{status}</p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || members.length === 0 || isCreating}
            className="btn-rainbow px-4 py-2 disabled:opacity-50"
          >
            {isCreating ? "Creating..." : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}
