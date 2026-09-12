import type { Env } from "./types";
import { findProvider, getProviderPortfolio, listProviders } from "./supabase";

const PROVIDERS_CACHE_SECONDS = 300;
const PROVIDER_CACHE_CONTROL = "public, max-age=60, s-maxage=300";
const PORTFOLIO_CACHE_CONTROL = "public, max-age=60, s-maxage=300";

function cors(env: Env, requestOrigin: string | null): Record<string, string> {
  const allowed = env.MAAK_ALLOW_ORIGIN?.trim();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed && requestOrigin === allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  }
  return headers;
}

function json(env: Env, requestOrigin: string | null, status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors(env, requestOrigin),
      ...extraHeaders,
    },
  });
}

function safeError(operation: string, error: unknown): void {
  console.error(`[maak-worker] ${operation} failed`, error);
}

function cacheResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", PROVIDER_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const requestOrigin = req.headers.get("Origin");
    const corsHeaders = cors(env, requestOrigin);

    if (req.method === "OPTIONS") {
      if (env.MAAK_ALLOW_ORIGIN && requestOrigin !== env.MAAK_ALLOW_ORIGIN) {
        return new Response(null, { status: 403, headers: corsHeaders });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return json(env, requestOrigin, 200, { ok: true });
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "api" && parts[1] === "providers" && parts.length === 2 && req.method === "GET") {
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), req);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      try {
        const response = cacheResponse(json(env, requestOrigin, 200, await listProviders(env), {
          "Cache-Control": PROVIDER_CACHE_CONTROL,
        }));
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        safeError("list providers", error);
        return json(env, requestOrigin, 503, { error: "service_unavailable" });
      }
    }

    if (parts[0] === "api" && parts[1] === "providers" && parts.length === 4 && parts[3] === "portfolio" && req.method === "GET") {
      const id = Number(parts[2]);
      if (!Number.isInteger(id) || id <= 0) return json(env, requestOrigin, 400, { error: "invalid_id" });

      const cache = caches.default;
      const cacheKey = new Request(url.toString(), req);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      try {
        const provider = await findProvider(env, id);
        if (!provider) return json(env, requestOrigin, 404, { error: "not_found" });
        const portfolio = await getProviderPortfolio(env, id);
        const response = new Response(JSON.stringify(portfolio), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...cors(env, requestOrigin),
            "Cache-Control": PORTFOLIO_CACHE_CONTROL,
          },
        });
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        safeError("get provider portfolio", error);
        return json(env, requestOrigin, 503, { error: "service_unavailable" });
      }
    }

    if (parts[0] === "api" && parts[1] === "providers" && parts.length === 3 && req.method === "GET") {
      const id = Number(parts[2]);
      if (!Number.isInteger(id) || id <= 0) {
        return json(env, requestOrigin, 400, { error: "invalid_id" });
      }
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), req);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      try {
        const provider = await findProvider(env, id);
        if (!provider) return json(env, requestOrigin, 404, { error: "not_found" });
        const response = cacheResponse(json(env, requestOrigin, 200, provider, {
          "Cache-Control": PROVIDER_CACHE_CONTROL,
        }));
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        safeError("get provider", error);
        return json(env, requestOrigin, 503, { error: "service_unavailable" });
      }
    }

    return json(env, requestOrigin, 404, { error: "not_found" });
  },
};
