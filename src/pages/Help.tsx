import { ArrowRight, CircleHelp, LifeBuoy } from "lucide-react";
import { useRouter } from "../router";
import { getFaqData } from "../lib/help";
import FaqSection from "../components/help/FaqSection";
import SupportForm from "../components/help/SupportForm";
import "../styles/help.css";

export default function Help() {
  const { navigate } = useRouter();
  const faq = getFaqData();

  return (
    <div className="help-page">
      <section className="help-hero">
        <div>
          <span className="help-kicker"><CircleHelp size={15} aria-hidden="true" /> HELP CENTER</span>
          <h1>How can we help?</h1>
          <p>Find quick answers about bookings, accounts, providers and payments, or contact the support team when you need more help.</p>
          <div className="help-hero-actions">
            <a href="#faq" className="primary help-hero-btn" onClick={(event) => { event.preventDefault(); document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" }); }}>
              Browse FAQs <ArrowRight size={16} aria-hidden="true" />
            </a>
            <button type="button" className="secondary help-hero-btn" onClick={() => document.getElementById("support")?.scrollIntoView({ behavior: "smooth" })}>
              Contact support
            </button>
          </div>
        </div>
        <div className="help-hero-card" aria-hidden="true">
          <LifeBuoy size={38} strokeWidth={1.8} />
          <strong>Customer support</strong>
          <span>Clear answers, one place.</span>
        </div>
      </section>

      <main className="help-content">
        <div id="faq"><FaqSection items={faq} /></div>
        <div id="support"><SupportForm onSent={() => undefined} /></div>
      </main>

      <footer className="help-footer">
        <span>Need to continue using Maak?</span>
        <button type="button" onClick={() => navigate("/discover")}>Back to services <ArrowRight size={15} aria-hidden="true" /></button>
      </footer>
    </div>
  );
}
