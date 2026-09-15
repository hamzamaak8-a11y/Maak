import { ArrowRight, LifeBuoy } from "lucide-react";
import { useRouter } from "../router";
import FaqSection from "../components/help/FaqSection";
import SupportForm from "../components/help/SupportForm";
import { useLanguage } from "../i18n";
import "../styles/help.css";

export default function Help() {
  const { navigate } = useRouter();
  const { t, dir } = useLanguage();
  const chevronFlip = dir === "rtl" ? { transform: "scaleX(-1)" } : undefined;

  return (
    <main className="screen help-page">
      <div className="mk-page-head">
        <div>
          <span className="mk-kicker">{t("v2.helpKicker")}</span>
          <h1>{t("v2.helpTitle")}</h1>
          <p className="mk-page-sub">{t("v2.helpSub")}</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <button
          type="button"
          className="mk-btn mk-btn--sm"
          onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
        >
          {t("v2.helpBrowseFaq")}
        </button>
        <button
          type="button"
          className="mk-btn mk-btn--secondary mk-btn--sm"
          onClick={() => document.getElementById("support")?.scrollIntoView({ behavior: "smooth" })}
        >
          {t("v2.helpContact")}
        </button>
      </div>

      <div className="mk-card mk-card--pad" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span className="mk-state-icon" style={{ margin: 0, width: 44, height: 44 }} aria-hidden="true">
          <LifeBuoy size={22} strokeWidth={1.9} />
        </span>
        <div>
          <b style={{ fontSize: 13.5 }}>{t("v2.helpCardTitle")}</b>
          <p style={{ fontSize: 12.5, color: "var(--mk-ink-3)" }}>{t("v2.helpCardSub")}</p>
        </div>
      </div>

      <div id="faq"><FaqSection /></div>
      <div id="support" style={{ marginTop: 18 }}><SupportForm onSent={() => undefined} /></div>

      <div style={{ marginTop: 24 }}>
        <button type="button" className="mk-btn mk-btn--ghost" onClick={() => navigate("/discover")}>
          {t("v2.helpBackToServices")}
          <ArrowRight size={15} aria-hidden="true" style={chevronFlip} />
        </button>
      </div>
    </main>
  );
}
