import { useEffect, useMemo, useState } from "react";
import { Command, Search, X } from "lucide-react";
import { useLanguage } from "../i18n";
import { useRouter } from "../router";

type Item = { label: string; section: string };

const AR: Item[] = [
  { label: "نظرة عامة", section: "overview" },
  { label: "طلبات التحقق", section: "verification" },
  { label: "الحجوزات", section: "bookings" },
  { label: "الرسائل", section: "messages" },
  { label: "مقدمو الخدمات", section: "providers" },
  { label: "العملاء", section: "customers" },
  { label: "السوق", section: "marketplace" },
  { label: "التقارير والتحليلات", section: "reports" },
  { label: "السجل والنشاط", section: "activity" },
  { label: "حسابات المسؤولين", section: "admins" },
  { label: "إعدادات النظام", section: "system" },
];

const FR: Item[] = [
  { label: "Vue d’ensemble", section: "overview" },
  { label: "Vérifications", section: "verification" },
  { label: "Réservations", section: "bookings" },
  { label: "Messages", section: "messages" },
  { label: "Prestataires", section: "providers" },
  { label: "Clients", section: "customers" },
  { label: "Marché", section: "marketplace" },
  { label: "Rapports & analyses", section: "reports" },
  { label: "Journal & activité", section: "activity" },
  { label: "Comptes administrateurs", section: "admins" },
  { label: "Paramètres système", section: "system" },
];

function openSection(section: string, label: string) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".admin-pro-nav button"));
  const button = buttons.find((item) => item.textContent?.replace(/\s+/g, " ").trim().includes(label));
  if (button) button.click();
  else {
    const fallback = buttons.find((item) => item.getAttribute("data-section") === section);
    fallback?.click();
  }
}

export default function AdminCommandPalette() {
  const { path } = useRouter();
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const items = lang === "fr" ? FR : AR;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items;
  }, [items, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!path.startsWith("/admin") || path === "/admin/login") return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const id = window.setTimeout(() => document.getElementById("maak-admin-command-input")?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!path.startsWith("/admin") || path === "/admin/login") return null;

  return (
    <>
      <button className="admin-command-hint" type="button" onClick={() => setOpen(true)} aria-label="Command palette">
        <Command size={14} />
        <span>{lang === "fr" ? "Rechercher" : "بحث"}</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <div className="admin-command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="admin-command-dialog" role="dialog" aria-modal="true" aria-label="Command palette" dir={lang === "fr" ? "ltr" : "rtl"}>
            <header>
              <div className="admin-command-search"><Search size={17} /><input id="maak-admin-command-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={lang === "fr" ? "Rechercher une section…" : "ابحث عن قسم…"} /></div>
              <button type="button" className="admin-command-close" onClick={() => setOpen(false)} aria-label={lang === "fr" ? "Fermer" : "إغلاق"}><X size={17} /></button>
            </header>
            <div className="admin-command-list">
              {filtered.map((item) => (
                <button key={item.section} type="button" className="admin-command-item" onClick={() => { openSection(item.section, item.label); setOpen(false); }}>
                  <span className="admin-command-icon"><Command size={15} /></span>
                  <span>{item.label}</span>
                  <kbd>↵</kbd>
                </button>
              ))}
              {!filtered.length ? <div className="admin-command-empty">{lang === "fr" ? "Aucun résultat" : "لا توجد نتائج"}</div> : null}
            </div>
            <footer><span>{lang === "fr" ? "Naviguer" : "تنقل"} ↑↓</span><span>{lang === "fr" ? "Sélectionner" : "اختيار"} ↵</span><span>Esc</span></footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
