import type { Env } from "./types";
import { findProvider, listProviders } from "./supabase";

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

function json(env: Env, requestOrigin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(env, requestOrigin) },
  });
}

function safeError(operation: string, error: unknown): void {
  console.error(`[maak-worker] ${operation} failed`, error);
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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
      try {
        return json(env, requestOrigin, 200, await listProviders(env));
      } catch (error) {
        safeError("list providers", error);
        return json(env, requestOrigin, 503, { error: "service_unavailable" });
      }
    }

    if (parts[0] === "api" && parts[1] === "providers" && parts.length === 3 && req.method === "GET") {
      const id = Number(parts[2]);
      if (!Number.isInteger(id) || id <= 0) {
        return json(env, requestOrigin, 400, { error: "invalid_id" });
      }
      try {
        const provider = await findProvider(env, id);
        if (!provider) return json(env, requestOrigin, 404, { error: "not_found" });
        return json(env, requestOrigin, 200, provider);
      } catch (error) {
        safeError("get provider", error);
        return json(env, requestOrigin, 503, { error: "service_unavailable" });
      }
    }

    return json(env, requestOrigin, 404, { error: "not_found" });
  },
};
