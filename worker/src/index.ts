import type { Env } from "./types";
import { findProvider, getProviderPortfolio, listProviders } from "./supabase";
import { sendPush } from "./push";
import { HttpError, createUser, createUsersBulk, recoveryLink, requireAdmin } from "./admin";

const PROVIDER_CACHE_CONTROL = "public, max-age=60, s-maxage=300";
const PORTFOLIO_CACHE_CONTROL = "public, max-age=60, s-maxage=300";
const UPSTREAM_TIMEOUT_MS = 10_000;

/** MAAK_ALLOW_ORIGIN may hold several origins separated by commas. Native apps send no Origin header and need no CORS. */
function allowedOrigin(env: Env, requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  const list = (env.MAAK_ALLOW_ORIGIN ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  return list.includes(requestOrigin) ? requestOrigin : null;
}

function cors(env: Env, requestOrigin: string | null): Record<string, string> {
  const allowed = allowedOrigin(env, requestOrigin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed) {
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

async function withTimeout<T>(operation: () => Promise<T>): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("upstream_timeout")), UPSTREAM_TIMEOUT_MS);
    }),
  ]);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const requestOrigin = req.headers.get("Origin");
    const corsHeaders = cors(env, requestOrigin);

    if (req.method === "OPTIONS") {
      if (requestOrigin && !allowedOrigin(env, requestOrigin)) {
        return new Response(null, { status: 403, headers: corsHeaders });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health" && req.method === "GET") {
      return json(env, requestOrigin, 200, { ok: true, features: ["providers", "admin"] }, { "Cache-Control": "no-store" });
    }

    const parts = url.pathname.split("/").filter(Boolean);

    if (parts[0] === "api" && parts[1] === "providers" && parts.length === 2 && req.method === "GET") {
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), req);
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      try {
        const response = cacheResponse(json(env, requestOrigin, 200, await withTimeout(() => listProviders(env)), {
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
        const provider = await withTimeout(() => findProvider(env, id));
        if (!provider) return json(env, requestOrigin, 404, { error: "not_found" });
        const portfolio = await withTimeout(() => getProviderPortfolio(env, id));
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
        const provider = await withTimeout(() => findProvider(env, id));
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

    // ---- push notifications (called by the database trigger; protected by a shared secret) ----
    if (parts.length === 2 && parts[0] === "push" && parts[1] === "notify" && req.method === "POST") {
      try {
        const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        return json(env, requestOrigin, 200, await sendPush(env, req, payload), { "Cache-Control": "no-store" });
      } catch (error) {
        if (error instanceof HttpError) return json(env, requestOrigin, error.status, { error: error.message }, { "Cache-Control": "no-store" });
        safeError("push notify", error);
        return json(env, requestOrigin, 502, { error: "push_failed" }, { "Cache-Control": "no-store" });
      }
    }

    // ---- admin-only endpoints (service-role operations) ----
    if (parts[0] === "admin" && req.method === "POST") {
      try {
        const admin = await requireAdmin(env, req);
        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
        if (parts.length === 2 && parts[1] === "users") {
          const result = await createUser(env, admin.id, body as never);
          return json(env, requestOrigin, result.ok ? 200 : 400, result, { "Cache-Control": "no-store" });
        }
        if (parts.length === 3 && parts[1] === "users" && parts[2] === "bulk") {
          const results = await createUsersBulk(env, admin.id, body.users as never);
          return json(env, requestOrigin, 200, { results }, { "Cache-Control": "no-store" });
        }
        if (parts.length === 4 && parts[1] === "users" && parts[3] === "recovery") {
          const redirect = typeof body.redirectTo === "string" && allowedOrigin(env, new URL(body.redirectTo).origin) ? body.redirectTo : undefined;
          return json(env, requestOrigin, 200, await recoveryLink(env, admin.id, parts[2], redirect), { "Cache-Control": "no-store" });
        }
      } catch (error) {
        if (error instanceof HttpError) return json(env, requestOrigin, error.status, { error: error.message }, { "Cache-Control": "no-store" });
        safeError("admin endpoint", error);
        return json(env, requestOrigin, 500, { error: "server_error" }, { "Cache-Control": "no-store" });
      }
    }

    return json(env, requestOrigin, 404, { error: "not_found" });
  },
};
