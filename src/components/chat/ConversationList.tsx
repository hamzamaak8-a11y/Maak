import { MessageCircle, UserRound } from "lucide-react";
import type { Conversation } from "../../lib/chat";
import { useLanguage } from "../../i18n";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
};

function formatTime(value: string | null, lang: "ar" | "fr") {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function ConversationList({ conversations, activeId, onSelect }: Props) {
  const { t, lang } = useLanguage();
  return (
    <aside className="chat-conversation-list" aria-label={t("chat.conversations")}>
      <div className="chat-list-heading">
        <div>
          <span className="section-kicker">{t("chat.inbox")}</span>
          <h2>{t("chat.conversations")}</h2>
        </div>
        <span className="count-badge">{conversations.length}</span>
      </div>
      <div className="chat-list-scroll">
        {conversations.length === 0 ? (
          <div className="chat-empty-list">
            <MessageCircle size={24} />
            <strong>{t("chat.noConversations")}</strong>
            <span>{t("chat.noConversationsBody")}</span>
          </div>
        ) : conversations.map((conversation) => (
          <button
            key={conversation.conversation_id}
            type="button"
            className={`chat-conversation-item ${activeId === conversation.conversation_id ? "active" : ""}`}
            onClick={() => onSelect(conversation.conversation_id)}
          >
            <span className="chat-avatar"><UserRound size={18} /></span>
            <span className="chat-conversation-copy">
              <span className="chat-conversation-top">
                <strong>{conversation.other_user_name || t("chat.unknownUser")}</strong>
                <small>{formatTime(conversation.last_message_at, lang)}</small>
              </span>
              <span className="chat-conversation-bottom">
                <span>{conversation.last_message || t("chat.startConversation")}</span>
                {conversation.unread_count > 0 && <b className="chat-unread">{conversation.unread_count > 99 ? "99+" : conversation.unread_count}</b>}
              </span>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
