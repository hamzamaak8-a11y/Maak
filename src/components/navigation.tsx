import type { LucideIcon } from "lucide-react";
import { ClipboardList, Globe, Home, MessageCircle, Search, UserRound } from "lucide-react";
import { useRouter } from "../router";
import { useToast } from "../context";
import { useAuth } from "../auth";
import { useLanguage } from "../i18n";
import { MaakLockup } from "./BrandMark";
import NotificationBell from "./notifications/NotificationBell";

type NavigationItem = readonly [string, string, LucideIcon, string];

const isRouteSelected = (path: string, route: string) =>
  route === "/" ? path === "/" : path === route || path.startsWith(`${route}/`);

function useNavItems(): NavigationItem[] {
  const { t } = useLanguage();
  return [
    ["home", t("nav.home"), Home, "/"],
    ["discover", t("nav.discover"), Search, "/discover"],
    ["bookings", t("nav.bookings"), ClipboardList, "/bookings"],
    ["chat", t("nav.chat"), MessageCircle, "/chat"],
    ["account", t("nav.account"), UserRound, "/account"],
  ];
}

export function Header({ path }: { path: string }) {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { user, loading, signOut, profile } = useAuth();
  const { t, lang, toggleLang } = useLanguage();

  async function handleSignOut() {
    await signOut();
    showToast(t("nav.loggedOut"));
    navigate("/");
  }

  const initial = (profile?.full_name || user?.email || "?").charAt(0).toUpperCase();
  const word = lang === "ar" ? "معك" : "Maak";
  const sub = lang === "ar" ? "خدمات موثوقة" : "services de confiance";

  return (
    <header className="mk-topbar">
      <div className="mk-topbar-inner">
        <button
          type="button"
          className="mk-brandline"
          onClick={() => navigate("/")}
          aria-label={t("nav.home")}
        >
          <MaakLockup word={word} sub={sub} />
        </button>

        <div className="mk-topbar-trail">
          <div className="notification-slot">
            <NotificationBell />
          </div>
          <button
            type="button"
            className="mk-langbtn"
            onClick={toggleLang}
            aria-label={t("lang.label")}
            title={lang === "ar" ? "Passer en Français" : "التحويل إلى العربية"}
          >
            <Globe size={13} aria-hidden="true" />
            <span>{lang === "ar" ? "FR" : "ع"}</span>
          </button>
          {loading ? (
            <span className="mk-avatarbtn mk-avatarbtn--busy" aria-busy="true" aria-label={t("common.loading")} />
          ) : user ? (
            <>
              <button
                type="button"
                className="mk-avatarbtn"
                aria-label={t("nav.account")}
                title={profile?.full_name || user.email || ""}
                onClick={() => navigate("/account")}
              >
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span aria-hidden="true">{initial}</span>}
              </button>
              <button
                type="button"
                className="mk-btn mk-btn--ghost mk-btn--sm desktop-only"
                onClick={handleSignOut}
              >
                {t("nav.logout")}
              </button>
            </>
          ) : (
            <button type="button" className="mk-btn mk-btn--sm" onClick={() => navigate("/login")}>
              {t("nav.login")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Desktop application rail (sidebar) — replaces website-style top links. */
export function SideRail({ path }: { path: string }) {
  const { navigate } = useRouter();
  const { t, lang } = useLanguage();
  const items = useNavItems();
  const word = lang === "ar" ? "معك" : "Maak";
  const sub = lang === "ar" ? "خدمات موثوقة" : "services de confiance";

  return (
    <nav className="mk-side" aria-label={t("nav.primary")}>
      <button type="button" className="mk-side-brand" onClick={() => navigate("/")} aria-label={t("nav.home")}>
        <MaakLockup word={word} sub={sub} />
      </button>
      <div className="mk-side-items">
        {items.map(([id, label, Icon, to]) => {
          const selected = isRouteSelected(path, to);
          return (
            <button
              key={id}
              type="button"
              className={"mk-side-item" + (selected ? " is-active" : "")}
              onClick={() => navigate(to)}
              aria-current={selected ? "page" : undefined}
            >
              <span className="mk-side-icon">
                <Icon size={19} strokeWidth={selected ? 2.4 : 2} aria-hidden="true" />
              </span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileNav({ path }: { path: string }) {
  const { navigate } = useRouter();
  const { t } = useLanguage();
  const items = useNavItems();

  return (
    <nav className="mk-bottomnav" aria-label={t("nav.primary")}>
      {items.map(([id, label, Icon, to]) => {
        const selected = isRouteSelected(path, to);
        return (
          <button
            key={id}
            type="button"
            className={"mk-tab" + (selected ? " is-active" : "")}
            onClick={() => navigate(to)}
            aria-current={selected ? "page" : undefined}
          >
            <span className="mk-tab-icon">
              <Icon size={20} strokeWidth={selected ? 2.4 : 2} aria-hidden="true" />
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
