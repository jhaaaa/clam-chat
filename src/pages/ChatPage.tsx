import { useState, useEffect, useCallback } from "react";
import { ConsentState, Group, type Conversation, type DecodedMessage } from "@xmtp/browser-sdk";
import { fileToAttachment, isInlineSize, encryptAndUpload, getUploader } from "@/lib/attachments";
import { useChatStore } from "@/store/chatStore";
import { useXmtp } from "@/components/providers/XmtpProvider";
import { useMessages } from "@/hooks/useMessages";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import ConversationHeader from "@/components/chat/ConversationHeader";
import ConsentBanner from "@/components/conversations/ConsentBanner";
import GroupInfoPanel from "@/components/chat/GroupInfoPanel";

export default function ChatPage() {
  const { selectedConversation, setSelectedConversation, refreshConversationList } = useChatStore();
  const { client } = useXmtp();
  const {
    messages, isLoading, sendMessage, sendReaction, sendReply,
    sendInlineAttachment, sendRemoteAttachment,
  } = useMessages(selectedConversation);
  const [consentState, setConsentState] = useState<ConsentState | null>(null);
  const [replyingTo, setReplyingTo] = useState<DecodedMessage | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [memberAddresses, setMemberAddresses] = useState<Map<string, string>>(new Map());

  // Load consent state, active status, and member addresses when conversation changes
  useEffect(() => {
    if (!selectedConversation) {
      setConsentState(null);
      setMemberAddresses(new Map());
      return;
    }
    let cancelled = false;
    selectedConversation.consentState().then((state) => {
      if (!cancelled) setConsentState(state);
    });
    // Build inboxId -> address map from members
    selectedConversation.members().then((members) => {
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const m of members) {
        const addr = m.accountIdentifiers?.[0]?.identifier;
        if (addr) map.set(m.inboxId, addr);
      }
      setMemberAddresses(map);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedConversation]);

  // Clear reply/group-info state when conversation changes
  useEffect(() => {
    setReplyingTo(null);
    setShowGroupInfo(false);
  }, [selectedConversation]);

  const handleSend = useCallback(
    async (text: string) => {
      if (replyingTo) {
        await sendReply(replyingTo.id, replyingTo.senderInboxId, text);
        setReplyingTo(null);
      } else {
        await sendMessage(text);
      }
    },
    [replyingTo, sendReply, sendMessage]
  );

  const handleSendAttachment = useCallback(
    async (file: File) => {
      const attachment = await fileToAttachment(file);
      if (isInlineSize(file)) {
        await sendInlineAttachment(attachment);
      } else {
        const uploader = getUploader();
        const remote = await encryptAndUpload(attachment, uploader);
        await sendRemoteAttachment(remote);
      }
    },
    [sendInlineAttachment, sendRemoteAttachment]
  );

  if (!selectedConversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        <div className="text-center">
          <img src="/clam.svg" alt="" className="mx-auto mb-3 h-12 w-12 opacity-40" />
          <p className="text-lg">Welcome to Clam Chat</p>
          <p className="mt-2 text-sm">
            Select a conversation or start a new one.
          </p>
        </div>
      </div>
    );
  }

  const isUnknown = consentState === ConsentState.Unknown;

  const handleConsentChanged = () => {
    selectedConversation.consentState().then(setConsentState);
    refreshConversationList();
  };

  const handleAccepted = () => {
    setConsentState(ConsentState.Allowed);
    refreshConversationList();
  };

  const handleBlocked = () => {
    refreshConversationList();
    setSelectedConversation(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ConversationHeader
        conversation={selectedConversation}
        onConsentChanged={handleConsentChanged}
        onShowGroupInfo={
          selectedConversation instanceof Group
            ? () => setShowGroupInfo(true)
            : undefined
        }
      />

      {isUnknown && (
        <ConsentBanner
          conversation={selectedConversation}
          onAccepted={handleAccepted}
          onBlocked={handleBlocked}
        />
      )}

      <MessageList
        messages={messages}
        selfInboxId={client?.inboxId || ""}
        isLoading={isLoading}
        memberAddresses={memberAddresses}
        onReact={sendReaction}
        onReply={setReplyingTo}
      />
      <MessageInput
        onSend={handleSend}
        onSendAttachment={handleSendAttachment}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />

      {showGroupInfo && selectedConversation instanceof Group && (
        <GroupInfoPanel
          group={selectedConversation}
          onClose={() => setShowGroupInfo(false)}
          onLeft={() => {
            setShowGroupInfo(false);
            setSelectedConversation(null);
            refreshConversationList();
          }}
        />
      )}

    </div>
  );
}
