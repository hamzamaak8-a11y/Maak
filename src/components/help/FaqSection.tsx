import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "../../i18n";
import { FAQ_IDS } from "../../i18n/v2";

export default function FaqSection() {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState<string | null>(FAQ_IDS[0] ?? null);

  return (
    <section aria-labelledby="help-faq-heading">
      <div className="mk-section-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, marginBottom: 10 }}>
        <span className="mk-kicker">{t("v2.faqKicker")}</span>
        <h2 id="help-faq-heading">{t("v2.faqTitle")}</h2>
        <p style={{ fontSize: 12.5, color: "var(--mk-ink-3)" }}>{t("v2.faqSub")}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {FAQ_IDS.map((id) => {
          const open = openId === id;
          return (
            <article className="mk-card" key={id}>
              <button
                type="button"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "13px 16px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  textAlign: "start",
                }}
                aria-expanded={open}
                aria-controls={`faq-answer-${id}`}
                onClick={() => setOpenId((current) => (current === id ? null : id))}
              >
                <span>{t(`v2.faq.${id}.q`)}</span>
                <ChevronDown size={17} aria-hidden="true" style={{ flex: "0 0 auto", color: "var(--mk-ink-3)", transform: open ? "scaleY(-1)" : undefined }} />
              </button>
              {open ? (
                <div id={`faq-answer-${id}`} style={{ padding: "0 16px 14px", fontSize: 13, color: "var(--mk-ink-2)", lineHeight: 1.7 }}>
                  {t(`v2.faq.${id}.a`)}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
