import { Home } from "lucide-react";
import { useRouter } from "../router";
import { useLanguage } from "../i18n";

export default function NotFound() {
  const { navigate } = useRouter();
  const { t } = useLanguage();

  return (
    <main className="screen" role="main">
      <section className="mk-notfound" role="status" aria-labelledby="not-found-title">
        <span className="mk-notfound-code" aria-hidden="true">404</span>
        <h1 id="not-found-title">{t("v2.notFoundTitle")}</h1>
        <p style={{ color: "var(--mk-ink-3)", fontSize: 14, maxWidth: "42ch" }}>{t("v2.notFoundBody")}</p>
        <button type="button" className="mk-btn" style={{ marginTop: 8 }} onClick={() => navigate("/")}>
          <Home size={16} aria-hidden="true" />
          {t("v2.notFoundCta")}
        </button>
      </section>
    </main>
  );
}
