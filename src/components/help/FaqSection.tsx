import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "../../lib/help";

type Props = { items: FaqItem[] };

export default function FaqSection({ items }: Props) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <section className="help-section" aria-labelledby="help-faq-heading">
      <div className="help-section-head">
        <span>FAQ</span>
        <h2 id="help-faq-heading">Frequently asked questions</h2>
        <p>Quick answers to the questions customers ask most often.</p>
      </div>
      <div className="help-faq-list">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <article className={`help-faq-item${open ? " open" : ""}`} key={item.id}>
              <button
                type="button"
                className="help-faq-trigger"
                aria-expanded={open}
                aria-controls={`faq-answer-${item.id}`}
                onClick={() => setOpenId((current) => (current === item.id ? null : item.id))}
              >
                <span>{item.question}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
              {open ? (
                <div id={`faq-answer-${item.id}`} className="help-faq-answer">
                  <p>{item.answer}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
