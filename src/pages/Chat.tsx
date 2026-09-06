import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { useLanguage } from "../i18n";
import { rememberReturnTo } from "../lib/returnTo";

/**
 * Messages screen.
 *
 * Messaging has no backend yet (no `messages` table / RPC), so this screen is
 * an honest, clearly-disabled empty state. It must never show a fabricated
 * conversation partner: earlier versions displayed the first marketplace
 * provider as if a chat existed with them, which was fake data.
 */
export default function Chat() {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const { navigate } = useRouter();

  if (loading) {
    return (
      <main className="screen chat-screen">
        <div className="state-loading">
          <Loader2 className="spin" size={22} />
          <p>{t("common.loading")}</p>
        </div>
      </main>
    );
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
            <button className="primary" onClick={() => goAuth("/login")}>
              {t("adminLogin.signIn")} <ArrowLeft size={16} />
            </button>
            <button className="ghost-button" onClick={() => goAuth("/register")}>
              {t("auth.createAccountBtn")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="screen chat-screen">
      <div className="chat-panel">
        <div className="chat-person">
          <span className="empty-msg" aria-hidden="true"><MessageCircle size={18} /></span>
          <div>
            <b>{t("chat.noConversation")}</b>
            <small>{t("chat.comingSoon")}</small>
          </div>
        </div>
        <div className="messages messages-empty">
          <span className="empty-msg"><MessageCircle size={26} /></span>
          <h3>{t("chat.noMessages")}</h3>
          <p>{t("chat.noMessagesBody")}</p>
        </div>
        <div className="message-compose">
          <input className="field" value="" disabled readOnly placeholder={t("chat.comingSoon")} aria-label={t("chat.comingSoon")} />
          <button className="primary send-button" disabled aria-label={t("common.send")}><ArrowLeft size={16} /></button>
        </div>
      </div>
    </main>
  );
}
