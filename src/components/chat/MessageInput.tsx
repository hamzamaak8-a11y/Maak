import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { useLanguage } from "../../i18n";

type Props = { disabled?: boolean; onSend: (body: string) => Promise<void> };

export default function MessageInput({ disabled, onSend }: Props) {
  const { t } = useLanguage();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); const value = body.trim(); if (!value || sending || disabled) return;
    setSending(true); try { await onSend(value); setBody(""); } finally { setSending(false); }
  }
  return <form className="chat-input-wrap" onSubmit={submit}><textarea className="chat-input" value={body} onChange={(event)=>setBody(event.target.value)} placeholder={t("chat.inputPlaceholder")} aria-label={t("chat.inputPlaceholder")} rows={1} maxLength={2000} disabled={disabled||sending} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void submit(event);}}}/><button className="primary chat-send" type="submit" disabled={disabled||sending||!body.trim()} aria-label={t("chat.send")} title={t("chat.send")}>{sending?<Loader2 size={18} className="spin"/>:<Send size={18}/>}</button></form>;
}
