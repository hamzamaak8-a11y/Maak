import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCheck, Loader2, MessageCircle, Send } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { useLanguage } from "../i18n";
import { rememberReturnTo } from "../lib/returnTo";
import {
  getMessages,
  getOrCreateProviderConversation,
  listConversations,
  markRead,
  sendMessage,
  type ChatMessage,
  type Conversation,
} from "../lib/chat";
import { supabase } from "../lib/supabaseClient";

function formatTime(value: string | null, lang: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

export default function Chat({ providerId }: { providerId?: string }) {
  const { t, lang, isRTL } = useLanguage();
  const { user, loading } = useAuth();
  const { navigate } = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingList(true);
    setError(null);
    void listConversations()
      .then((rows) => {
        if (!active) return;
        setConversations(rows);
        if (!providerId && !selectedId && rows[0]) setSelectedId(rows[0].conversation_id);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "chat.loadFail"))
      .finally(() => active && setLoadingList(false));
    return () => {
      active = false;
    };
  }, [user, providerId]);

  useEffect(() => {
    if (!user || !providerId) return;
    let active = true;
    setOpening(true);
    setError(null);
    void getOrCreateProviderConversation(providerId)
      .then(async (id) => {
        if (!active) return;
        setSelectedId(id);
        const rows = await listConversations();
        if (active) setConversations(rows);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "chat.openFail"))
      .finally(() => active && setOpening(false));
    return () => {
      active = false;
    };
  }, [user, providerId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let active = true;
    setLoadingMessages(true);
    void getMessages(selectedId)
      .then((rows) => active && setMessages(rows))
      .catch((e) => active && setError(e instanceof Error ? e.message : "chat.loadMessagesFail"))
      .finally(() => active && setLoadingMessages(false));

    void markRead(selectedId).catch(() => {});
    const channel = supabase
      .channel(`maak-chat-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((current) => (current.some((m) => m.id === row.id) ? current : [...current, row]));
          if (row.sender_id !== user?.id) void markRead(selectedId).catch(() => {});
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedId, user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!selectedId || !body || sending) return;
    setSending(true);
    setError(null);
    try {
      const row = await sendMessage(selectedId, body);
      setMessages((current) => (current.some((m) => m.id === row.id) ? current : [...current, row]));
      setDraft("");
      setConversations((current) =>
        current.map((c) =>
          c.conversation_id === selectedId
            ? { ...c, last_message: row.body, last_message_at: row.created_at, unread_count: 0 }
            : c,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "chat.sendFail");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return <main className="screen chat-screen"><div className="state-loading"><Loader2 className="spin" size={22} /><p>{t("common.loading")}</p></div></main>;
  }

  if (!user) {
    const goAuth = (target: "/login" | "/register") => {
      rememberReturnTo("/chat");
      navigate(target);
    };
    return (
      <main className="screen chat-screen">
        <div className="auth-gate">
          <h3>{t("chat.loginRequired")}</h3>
          <p>{t("chat.loginRequiredBody")}</p>
          <div className="actions">
            <button className="primary" onClick={() => goAuth("/login")}>{t("adminLogin.signIn")} <ArrowLeft size={16} /></button>
            <button className="ghost-button" onClick={() => goAuth("/register")}>{t("auth.createAccountBtn")}</button>
          </div>
        </div>
      </main>
    );
  }

  const selected = conversations.find((c) => c.conversation_id === selectedId);
  const shownError = error ? t(error) : null;

  return (
    <main className="screen chat-screen">
      <div className="chat-workspace">
        <aside className="chat-list" aria-label={t("nav.messages")}>
          <div className="chat-list-head"><div><span className="section-kicker">{t("nav.messages")}</span><h1>{t("nav.messages")}</h1></div><MessageCircle size={21} /></div>
          {loadingList || opening ? (
            <div className="state-loading compact"><Loader2 className="spin" size={18} /></div>
          ) : conversations.length === 0 ? (
            <div className="chat-list-empty"><MessageCircle size={24} /><b>{t("chat.noConversation")}</b><span>{t("chat.noMessagesBody")}</span></div>
          ) : (
            conversations.map((conversation) => (
              <button type="button" className={`chat-list-item ${conversation.conversation_id === selectedId ? "active" : ""}`} key={conversation.conversation_id} onClick={() => setSelectedId(conversation.conversation_id)}>
                <span className="chat-avatar">{(conversation.other_user_name || "م").trim().slice(0, 1)}</span>
                <span className="chat-list-copy"><strong>{conversation.other_user_name || t("chat.userFallback")}</strong><small>{conversation.last_message || t("chat.noMessages")}</small></span>
                <span className="chat-list-meta"><time>{formatTime(conversation.last_message_at, lang)}</time>{conversation.unread_count > 0 ? <em>{conversation.unread_count}</em> : null}</span>
              </button>
            ))
          )}
        </aside>

        <section className="chat-conversation">
          {selected ? (
            <>
              <header className="chat-header"><div className="chat-header-person"><span className="chat-avatar">{(selected.other_user_name || "م").trim().slice(0, 1)}</span><div><strong>{selected.other_user_name || t("chat.userFallback")}</strong><small>{t("chat.secureConversation")}</small></div></div><button className="ghost-button" type="button" onClick={() => setSelectedId(null)}>{t("common.close")}</button></header>
              <div className="messages" aria-live="polite">
                {loadingMessages ? <div className="state-loading"><Loader2 className="spin" size={22} /><p>{t("common.loading")}</p></div> : messages.length === 0 ? <div className="messages-empty"><span className="empty-msg"><MessageCircle size={26} /></span><h3>{t("chat.noMessages")}</h3><p>{t("chat.startConversation")}</p></div> : messages.map((message) => {
                  const mine = message.sender_id === user.id;
                  return <div key={message.id} className={`chat-bubble-row ${mine ? "mine" : "theirs"}`}><div className={`chat-bubble ${mine ? "me" : "them"}`} dir={isRTL ? "rtl" : "ltr"}><span>{message.body}</span><small>{formatTime(message.created_at, lang)} {mine ? <CheckCheck size={12} /> : null}</small></div></div>;
                })}
                <div ref={endRef} />
              </div>
              {shownError ? <div className="chat-error" role="alert">{shownError}</div> : null}
              <div className="chat-composer"><input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }} maxLength={4000} aria-label={t("chat.messageLabel")} disabled={sending} /><button className="primary send-button" type="button" disabled={!draft.trim() || sending} onClick={() => void handleSend()} aria-label={t("common.send")}>{sending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}</button></div>
            </>
          ) : (
            <div className="messages-empty chat-no-selection"><MessageCircle size={34} /><h3>{t("chat.selectConversation")}</h3><p>{t("chat.noMessagesBody")}</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
