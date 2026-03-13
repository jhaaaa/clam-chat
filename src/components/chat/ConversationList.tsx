import { useState } from "react";
import type { Conversation } from "@xmtp/browser-sdk";
import { useXmtp } from "@/components/providers/XmtpProvider";
import { useChatStore } from "@/store/chatStore";
import { useConversations } from "@/hooks/useConversations";
import ConversationItem from "./ConversationItem";
import NewConversationDialog from "./NewConversationDialog";
import NewGroupDialog from "./NewGroupDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

type Tab = "inbox" | "requests";

export default function ConversationList() {
  const { client } = useXmtp();
  const { selectedConversation, setSelectedConversation } = useChatStore();
  const { conversations, requests, isLoading, refresh } =
    useConversations(client);
  const [activeTab, setActiveTab] = useState<Tab>("inbox");

  // Auto-switch to inbox if selected conversation moved there
  const selectedInInbox =
    selectedConversation &&
    conversations.some((c) => c.id === selectedConversation.id);
  const selectedInRequests =
    selectedConversation &&
    requests.some((c) => c.id === selectedConversation.id);

  if (selectedInInbox && activeTab === "requests") {
    setActiveTab("inbox");
  } else if (selectedInRequests && activeTab === "inbox") {
    setActiveTab("requests");
  }
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [search, setSearch] = useState("");

  const handleSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleNewConversationCreated = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowNewConversation(false);
    refresh();
  };

  const activeList = activeTab === "inbox" ? conversations : requests;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Actions */}
      <div className="flex items-center justify-end border-b border-gray-100 px-4 py-2 dark:border-gray-800">
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowNewConversation(true)}
            className="btn-rainbow px-2.5 py-1.5 text-xs"
          >
            New DM
          </button>
          <button
            onClick={() => setShowNewGroup(true)}
            className="rounded-lg border border-indigo-600 px-2.5 py-1.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-400 dark:hover:bg-indigo-950"
          >
            New group
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setActiveTab("inbox")}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "inbox"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Inbox{conversations.length > 0 && ` (${conversations.length})`}
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "requests"
              ? "border-b-2 border-indigo-600 text-indigo-600"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          }`}
        >
          Requests{requests.length > 0 && ` (${requests.length})`}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by group name or message text"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-1 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-900"
        />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="md" label="Loading conversations..." />
          </div>
        ) : activeList.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {activeTab === "inbox"
                ? "No conversations yet"
                : "No message requests"}
            </p>
            {activeTab === "inbox" && (
              <button
                onClick={() => setShowNewConversation(true)}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
              >
                Start a conversation
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {activeList.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedConversation?.id === conv.id}
                onClick={() => handleSelect(conv)}
                searchFilter={search}
              />
            ))}
          </div>
        )}
      </div>

      {/* New conversation dialog */}
      {showNewConversation && (
        <NewConversationDialog
          onClose={() => setShowNewConversation(false)}
          onCreated={handleNewConversationCreated}
        />
      )}

      {/* New group dialog */}
      {showNewGroup && (
        <NewGroupDialog
          onClose={() => setShowNewGroup(false)}
          onCreated={(group) => {
            setSelectedConversation(group);
            setShowNewGroup(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
