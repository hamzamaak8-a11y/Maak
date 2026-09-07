import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Minimal client-side router (history API).
 * Dynamically supports both root "/" and sub-path "/Maak" (GitHub Pages).
 */
function getBasename(): string {
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (pathname === "/Maak" || pathname.startsWith("/Maak/")) return "/Maak";
  }
  return "";
}
function toRelative(pathname: string): string {
  const base = getBasename();
  let path = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path;
}
function currentPath(): string { return typeof window !== "undefined" ? toRelative(window.location.pathname) : "/"; }

type RouterContextValue = { path: string; navigate: (to: string) => void };
const RouterContext = createContext<RouterContextValue>({ path: "/", navigate: () => {} });

export function Router({ children }: { children: ReactNode }) {
  const [path, setPath] = useState<string>(currentPath);
  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback((to: string) => {
    const base = getBasename();
    const target = to.startsWith("/") ? to : "/" + to;
    const url = base ? base + (target === "/" ? "/" : target) : target;
    if (window.location.pathname !== url) {
      window.history.pushState({}, "", url);
      setPath(toRelative(url));
      window.scrollTo(0, 0);
    }
  }, []);
  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}
export function useRouter(): RouterContextValue { return useContext(RouterContext); }

export function Link({ to, className, children, onClick, ariaLabel }: {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const { navigate } = useRouter();
  const base = getBasename();
  const href = base ? base + (to === "/" ? "/" : to) : to;
  return <a href={href} className={className} aria-label={ariaLabel} onClick={(event: MouseEvent) => {
    event.preventDefault();
    onClick?.();
    navigate(to);
  }}>{children}</a>;
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  try {
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(":")) params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      else if (patternParts[i] !== pathParts[i]) return null;
    }
  } catch {
    return null;
  }
  return params;
}