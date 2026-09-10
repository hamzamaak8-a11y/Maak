import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, MessageCircle, RefreshCw, UserRound } from "lucide-react";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import { useRouter } from "../router";
import { getMessages, listConversations, markRead, sendMessage, subscribeToConversation, type ChatMessage, type ChatRealtimeStatus, type Conversation } from "../lib/chat";
import ConversationList from "../components/chat/ConversationList";
import MessageList from "../components/chat/MessageList";
import MessageInput from "../components/chat/MessageInput";
import "../components/chat/chat.css";

export default function Chat({ conversationId }: { conversationId?: string }) {
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { navigate } = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(conversationId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<ChatRealtimeStatus | null>(null);
  const [mobileList, setMobileList] = useState(!conversationId);

  useEffect(() => { if (!authLoading && !user) navigate("/login"); }, [authLoading, user, navigate]);
  useEffect(() => { if (conversationId) { setActiveId(conversationId); setMobileList(false); } }, [conversationId]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true); setError(null);
    void listConversations().then((rows) => {
      if (!alive) return;
      setConversations(rows);
      if (conversationId) {
        if (!rows.some((row) => row.conversation_id === conversationId)) setActiveId(null);
      } else {
        const next = activeId && rows.some((row) => row.conversation_id === activeId) ? activeId : rows[0]?.conversation_id ?? null;
        setActiveId(next);
        if (next) navigate(`/chat/${next}`);
      }
    }).catch((err) => { if (alive) setError(err instanceof Error ? t(err.message) : t("chat.loadFail")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id, conversationId]);

  useEffect(() => {
    if (!activeId || !user) { setMessages([]); return; }
    let alive = true;
    setMessagesLoading(true); setMessageError(null); setRealtimeStatus(null);
    void getMessages(activeId).then((rows) => { if (alive) setMessages(rows); }).catch((err) => {
      if (alive) setMessageError(err instanceof Error ? t(err.message) : t("chat.loadMessagesFail"));
    }).finally(() => { if (alive) setMessagesLoading(false); });
    void markRead(activeId).catch(() => undefined);
    const cleanup = subscribeToConversation(activeId, (message) => {
      if (!alive) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setConversations((current) => current.map((item) => item.conversation_id === activeId ? { ...item, last_message: message.body, last_message_at: message.created_at, unread_count: 0 } : item));
    }, (status) => { if (alive) setRealtimeStatus(status); });
    return () => { alive = false; cleanup(); };
  }, [activeId, user?.id]);

  const activeConversation = useMemo(() => conversations.find((item) => item.conversation_id === activeId) ?? null, [conversations, activeId]);
  function selectConversation(id: string) { setActiveId(id); setMobileList(false); setMessageError(null); navigate(`/chat/${id}`); }

  async function handleSend(body: string) {
    if (!activeId) return;
    setMessageError(null);
    try {
      const sent = await sendMessage(activeId, body);
      setMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent]);
      setConversations((current) => current.map((item) => item.conversation_id === activeId ? { ...item, last_message: sent.body, last_message_at: sent.created_at } : item));
    } catch (err) {
      setMessageError(err instanceof Error ? t(err.message) : t("chat.sendFail"));
      throw err;
    }
  }

  if (authLoading || (loading && !conversations.length)) return <main className="screen"><div className="pdetail-loading"><Loader2 className="spin" size={24}/><p>{t("common.loading")}</p></div></main>;
  if (!user) return null;

  return (
    <main className="chat-page">
      <div className="chat-shell">
        <div className={`chat-list-pane ${mobileList ? "mobile-visible" : "mobile-hidden"}`}><ConversationList conversations={conversations} activeId={activeId} onSelect={selectConversation}/></div>
        <section className={`chat-main ${mobileList ? "mobile-hidden" : "mobile-visible"}`} aria-label={t("chat.messages")}>
          {activeId && activeConversation ? <>
            <header className="chat-main-header">
              <button className="chat-back" type="button" onClick={() => setMobileList(true)} aria-label={t("common.back")}><ArrowLeft size={17}/></button>
              <span className="chat-main-avatar"><UserRound size={18}/></span>
              <div><strong>{activeConversation.other_user_name || t("chat.unknownUser")}</strong><small>{realtimeStatus === "SUBSCRIBED" ? t("chat.realtimeConnected") : t("chat.realtimeConnecting")}</small></div>
              <span className={`chat-realtime-dot ${realtimeStatus === "SUBSCRIBED" ? "" : "off"}`} aria-hidden="true"/>
            </header>
            {messageError && <div className="chat-error" role="alert">{messageError}</div>}
            {(realtimeStatus === "CHANNEL_ERROR" || realtimeStatus === "TIMED_OUT") && <div className="chat-error" role="status">{t("chat.realtimeError")}</div>}
            {messagesLoading ? <div className="chat-message-empty"><Loader2 size={22} className="spin"/><span>{t("chat.loadingMessages")}</span></div> : <MessageList messages={messages} currentUserId={user.id}/>} 
            <MessageInput disabled={messagesLoading} onSend={handleSend}/>
          </> : <div className="chat-message-empty"><MessageCircle size={30}/><strong>{conversations.length ? t("chat.selectConversation") : t("chat.noConversations")}</strong><span>{conversations.length ? t("chat.selectConversationBody") : t("chat.noConversationsBody")}</span></div>}
        </section>
      </div>
      {error && <div className="chat-error" role="alert">{error} <button className="mini-button" type="button" onClick={() => window.location.reload()}><RefreshCw size={14}/>{t("common.retry")}</button></div>}
    </main>
  );
}
