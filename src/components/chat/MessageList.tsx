import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../lib/chat";
import { useLanguage } from "../../i18n";

type Props = { messages: ChatMessage[]; currentUserId: string | null };

function formatTime(value: string, lang: "ar" | "fr") {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-MA", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch { return ""; }
}

export default function MessageList({ messages, currentUserId }: Props) {
  const { t, lang } = useLanguage();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);

  if (!messages.length) {
    return <div className="chat-message-empty"><span className="chat-empty-icon">✦</span><strong>{t("chat.emptyMessages")}</strong><span>{t("chat.emptyMessagesBody")}</span></div>;
  }

  return (
    <div className="chat-message-list" aria-live="polite" aria-label={t("chat.messages")}>
      {messages.map((message) => {
        const mine = message.sender_id === currentUserId;
        return (
          <div key={message.id} className={`chat-message-row ${mine ? "mine" : "theirs"}`}>
            <div className="chat-bubble">
              <span className="chat-bubble-body">{message.body}</span>
              <time dateTime={message.created_at}>{formatTime(message.created_at, lang)}</time>
            </div>
          </div>
        );
      })}
      <div ref={endRef} aria-hidden="true" />
    </div>
  );
}
