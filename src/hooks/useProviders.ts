import { useEffect, useState } from "react";
import type { Provider } from "../types";
import { fetchProvider, fetchProviders } from "../services";

type Status = "loading" | "success" | "error";

// Seed/demo listings are OPT-IN: hidden unless VITE_INCLUDE_SEED is explicitly
// set to "true" (e.g. .env.development for local styling). Production sets
// VITE_INCLUDE_SEED=false in .env.production so seed listings are never
// presented as real marketplace providers. Do not rely on an implicit default.
const INCLUDE_SEED: boolean = (import.meta.env.VITE_INCLUDE_SEED as string | undefined) === "true";

// Client visibility mirrors the database/Worker production contract:
// only published real listings linked to a provider profile are marketable.
// The database remains the final authorization boundary.
function isListed(p: Provider): boolean {
  if (p.listing_kind === "real") {
    return p.provider_profile_id != null && p.published_at != null;
  }
  if (p.listing_kind === "seed") return INCLUDE_SEED;
  return false;
}

// A listing is bookable only when it is a published real provider linked to a
// real provider profile. The database RPC remains the final protection.
export function isBookable(p: Provider | undefined): p is Provider {
  return !!p && p.listing_kind === "real" && p.provider_profile_id != null && p.published_at != null;
}

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetchProviders()
      .then((data) => {
        if (!active) return;
        setProviders(data.filter(isListed));
        setStatus("success");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const refetch = () => setReload((n) => n + 1);
  return { providers, status, refetch };
}

export function useProvider(id: number) {
  const [provider, setProvider] = useState<Provider | undefined>(undefined);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetchProvider(id)
      .then((data) => {
        if (!active) return;
        setProvider(data && isListed(data) ? data : undefined);
        setStatus("success");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  return { provider, status };
}
