import { useState, useEffect, useCallback } from "react";
import {
  Group,
  IdentifierKind,
  type GroupMember,
  type Identifier,
} from "@xmtp/browser-sdk";
import { isAddress } from "viem";
import { normalize } from "viem/ens";
import { useXmtp } from "@/components/providers/XmtpProvider";
import { ensClient } from "@/lib/ens";

interface GroupInfoPanelProps {
  group: Group;
  onClose: () => void;
  onLeft: () => void;
}

function roleBadge(level: number): string {
  if (level === 2) return "Owner";
  if (level === 1) return "Admin";
  return "Member";
}

function roleColor(level: number): string {
  if (level === 2) return "text-amber-600 bg-amber-50";
  if (level === 1) return "text-indigo-600 bg-indigo-50";
  return "text-gray-500 bg-gray-50";
}

function shortenId(id: string): string {
  return id.slice(0, 6) + "..." + id.slice(-4);
}

export default function GroupInfoPanel({
  group,
  onClose,
  onLeft,
}: GroupInfoPanelProps) {
  const { client } = useXmtp();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(group.name || "");
  const [addInput, setAddInput] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const loadMembers = useCallback(async () => {
    try {
      await group.sync();
      const m = await group.members();
      setMembers(m);
      if (client?.inboxId) {
        const superAdmin = await group.isSuperAdmin(client.inboxId);
        const regularAdmin = await group.isAdmin(client.inboxId);
        setIsSuperAdmin(superAdmin);
        setIsAdmin(superAdmin || regularAdmin);
      }
    } catch (err) {
      console.error("[clam-chat] Failed to load members:", err);
    } finally {
      setIsLoading(false);
    }
  }, [group, client]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleUpdateName = async () => {
    if (!nameInput.trim()) return;
    try {
      await group.updateName(nameInput.trim());
      setEditingName(false);
    } catch (err) {
      console.error("[clam-chat] Failed to update group name:", err);
      setError("Failed to update name");
    }
  };

  const handleAddMember = async () => {
    const value = addInput.trim();
    if (!value || !client) return;
    setError("");
    setStatus("Resolving...");

    try {
      let address: string;

      if (value.endsWith(".eth") || value.includes(".")) {
        const ensAddress = await ensClient.getEnsAddress({
          name: normalize(value),
        });
        if (!ensAddress) {
          setError(`Could not resolve "${value}".`);
          setStatus("");
          return;
        }
        address = ensAddress.toLowerCase();
      } else if (isAddress(value)) {
        address = value.toLowerCase();
      } else {
        setError("Enter a valid address or ENS name.");
        setStatus("");
        return;
      }

      const identifier: Identifier = {
        identifier: address,
        identifierKind: IdentifierKind.Ethereum,
      };

      setStatus("Checking XMTP identity...");
      const canMsg = await client.canMessage([identifier]);
      if (!canMsg.get(address)) {
        setError("This address isn't on XMTP yet.");
        setStatus("");
        return;
      }

      setStatus("Adding member...");
      await group.addMembersByIdentifiers([identifier]);
      setAddInput("");
      setStatus("");
      loadMembers();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to add member";
      setError(message);
      setStatus("");
    }
  };

  const handleRemoveMember = async (inboxId: string) => {
    try {
      await group.removeMembers([inboxId]);
      loadMembers();
    } catch (err) {
      console.error("[clam-chat] Failed to remove member:", err);
      setError("Failed to remove member");
    }
  };

  const handlePromoteToAdmin = async (inboxId: string) => {
    try {
      await group.addAdmin(inboxId);
      loadMembers();
    } catch (err) {
      console.error("[clam-chat] Failed to promote to admin:", err);
      setError("Failed to promote to admin");
    }
  };

  const handleDemoteAdmin = async (inboxId: string) => {
    try {
      await group.removeAdmin(inboxId);
      loadMembers();
    } catch (err) {
      console.error("[clam-chat] Failed to demote admin:", err);
      setError("Failed to demote admin");
    }
  };

  const handlePromoteToSuperAdmin = async (inboxId: string) => {
    try {
      await group.addSuperAdmin(inboxId);
      loadMembers();
    } catch (err) {
      console.error("[clam-chat] Failed to promote to super admin:", err);
      setError("Failed to promote to super admin");
    }
  };

  const handleDemoteSuperAdmin = async (inboxId: string) => {
    try {
      await group.removeSuperAdmin(inboxId);
      loadMembers();
    } catch (err) {
      console.error("[clam-chat] Failed to demote super admin:", err);
      setError("Failed to demote super admin");
    }
  };

  const handleLeave = async () => {
    try {
      await group.requestRemoval();
      onLeft();
    } catch (err) {
      console.error("[clam-chat] Failed to leave group:", err);
      setError("Failed to leave group");
    }
  };

  const selfInboxId = client?.inboxId || "";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:px-4">
      <div className="w-full max-h-[90dvh] overflow-y-auto rounded-t-xl bg-white shadow-xl md:mb-0 md:max-w-md md:rounded-xl dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-gray-100">Group info</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {/* Group name */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
              Group name
            </label>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                  autoFocus
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
                <button
                  onClick={handleUpdateName}
                  className="btn-rainbow px-3 py-2 text-xs"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNameInput(group.name || "");
                  }}
                  className="rounded-lg px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium dark:text-gray-100">
                  {group.name || "Unnamed Group"}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Members */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-400">
              Members ({members.length})
            </label>
            {isLoading ? (
              <p className="text-xs text-gray-400">Loading members...</p>
            ) : (
              <div className="space-y-1.5">
                {members.map((member) => (
                  <div
                    key={member.inboxId}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                          {member.inboxId === selfInboxId
                            ? "You"
                            : shortenId(member.inboxId)}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${roleColor(member.permissionLevel)}`}
                        >
                          {roleBadge(member.permissionLevel)}
                        </span>
                      </div>
                      {member.accountIdentifiers.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {member.accountIdentifiers[0].identifier.slice(0, 10)}
                          ...
                        </p>
                      )}
                    </div>
                    {isAdmin &&
                      member.inboxId !== selfInboxId && (
                        <div className="ml-2 flex shrink-0 items-center gap-1">
                          {isSuperAdmin && member.permissionLevel === 0 && (
                            <button
                              onClick={() => handlePromoteToAdmin(member.inboxId)}
                              className="rounded px-1.5 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50"
                              title="Promote to admin"
                            >
                              Make admin
                            </button>
                          )}
                          {isSuperAdmin && member.permissionLevel === 1 && (
                            <>
                              <button
                                onClick={() => handlePromoteToSuperAdmin(member.inboxId)}
                                className="rounded px-1.5 py-0.5 text-xs text-amber-600 hover:bg-amber-50"
                                title="Promote to owner"
                              >
                                Make owner
                              </button>
                              <button
                                onClick={() => handleDemoteAdmin(member.inboxId)}
                                className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100"
                                title="Demote to member"
                              >
                                Demote
                              </button>
                            </>
                          )}
                          {isSuperAdmin && member.permissionLevel === 2 && (
                            <button
                              onClick={() => handleDemoteSuperAdmin(member.inboxId)}
                              className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100"
                              title="Demote from owner"
                            >
                              Demote
                            </button>
                          )}
                          {member.permissionLevel < 2 && (
                            <button
                              onClick={() => handleRemoveMember(member.inboxId)}
                              className="text-xs text-gray-400 hover:text-red-500"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add member (admin only) */}
          {isAdmin && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-600 dark:text-gray-400">
                Add member
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                  placeholder="0x... or name.eth"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                />
                <button
                  onClick={handleAddMember}
                  disabled={!addInput.trim()}
                  className="btn-rainbow shrink-0 px-3 py-2 text-xs disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {status && !error && (
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{status}</p>
          )}
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          {/* Leave group */}
          <button
            onClick={handleLeave}
            className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Leave group
          </button>
        </div>
      </div>
    </div>
  );
}
