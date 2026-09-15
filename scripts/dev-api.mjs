#!/usr/bin/env node
/**
 * Local development stand-in for the Cloudflare Worker public reads
 * (GET /api/providers, GET /api/providers/:id, GET /api/providers/:id/portfolio).
 *
 * Purpose: visual QA of the UI in environments without network access to the
 * production Worker/Supabase. The rows below are SEED fixtures
 * (listing_kind:"seed") — the client only shows seed listings when
 * VITE_INCLUDE_SEED=true, which production explicitly disables
 * (.env.production sets it to "false"). Nothing here ships to production.
 *
 * Usage: npm run dev:api   (then `npm run dev` proxies /api to it)
 */

import http from "node:http";

const PORT = Number(process.env.MAAK_DEV_API_PORT || 8787);

const now = new Date().toISOString();

/** @type {Array<Record<string, unknown>>} */
const providers = [
  {
    id: 1,
    name: "يوسف العمراني",
    job: "سباك محترف",
    city: "الدار البيضاء",
    distance: "2.4 كم",
    price: "150 درهم",
    rating: "4.8",
    reviews: 132,
    image: null,
    available: true,
    services: ["تسريب الماء", "تركيب صنابير", "إصلاح سخان"],
    experience: "8",
    intro:
      "سباك معتمد بخبرة ثماني سنوات في صيانة وتركيب شبكات الماء المنزلية. أعمل بسرعة ونظافة، مع ضمان على الإصلاحات.",
    provider_profile_id: "seed-provider-1",
    listing_kind: "seed",
    published_at: now,
    is_featured: true,
  },
  {
    id: 2,
    name: "سعاد بنعلي",
    job: "تقنية كهرباء",
    city: "الرباط",
    distance: "1.1 كم",
    price: "200 درهم",
    rating: "4.9",
    reviews: 87,
    image: null,
    available: true,
    services: ["تمديد كهرباء", "إنارة ولوحات", "صيانة الأجهزة"],
    experience: "6",
    intro: "تقنية كهرباء حاصلة على شهادة مهنية. تشخيص دقيق للأعطال وحلول آمنة مطابقة للمعايير.",
    provider_profile_id: "seed-provider-2",
    listing_kind: "seed",
    published_at: now,
    is_featured: true,
  },
  {
    id: 3,
    name: "كريم الإدريسي",
    job: "دهان وديكور",
    city: "الدار البيضاء",
    distance: "3.7 كم",
    price: "عند التواصل",
    rating: "4.6",
    reviews: 54,
    image: null,
    available: false,
    services: ["دهان جدران", "ديكور وجبس", "صباغة"],
    experience: "10",
    intro: null,
    provider_profile_id: "seed-provider-3",
    listing_kind: "seed",
    published_at: now,
    is_featured: false,
  },
  {
    id: 4,
    name: "نجاة الحسني",
    job: "خدمات تنظيف",
    city: "مراكش",
    distance: "800 م",
    price: "120 درهم",
    rating: "4.7",
    reviews: 203,
    image: null,
    available: true,
    services: ["تنظيف منزل", "تنظيف بعد البناء", "صيانة عامة"],
    experience: "5",
    intro: "فريق تنظيف مجهز بمواد صديقة للبيئة. نلتزم بالمواعيد وبجودة ثابتة.",
    provider_profile_id: "seed-provider-4",
    listing_kind: "seed",
    published_at: now,
    is_featured: false,
  },
  {
    id: 5,
    name: "عبد الرحيم الطاهري",
    job: "نجارة وتركيب أثاث",
    city: "الرباط",
    distance: "5.2 كم",
    price: null,
    rating: null,
    reviews: 0,
    image: null,
    available: null,
    services: ["نجارة أبواب", "تركيب الأثاث", "نقل أثاث"],
    experience: "12",
    intro: null,
    provider_profile_id: "seed-provider-5",
    listing_kind: "seed",
    published_at: now,
    is_featured: false,
  },
  {
    id: 6,
    name: "حسن أمزيل",
    job: "صيانة تكييف",
    city: "أكادير",
    distance: "1.9 كم",
    price: "180 درهم",
    rating: "4.5",
    reviews: 41,
    image: null,
    available: true,
    services: ["صيانة تكييف", "تكييف وتبريد", "إصلاحات عامة"],
    experience: "7",
    intro: "صيانة وتركيب مكيفات جميع الأنواع، مع فحص دوري وتنظيف شامل للوحدة.",
    provider_profile_id: "seed-provider-6",
    listing_kind: "seed",
    published_at: now,
    is_featured: false,
  },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname.replace(/\/$/, "") || "/";

  const json = (status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };

  if (path === "/api/health") return json(200, { ok: true, devFixture: true });
  if (path === "/api/providers") return json(200, providers);

  const detail = path.match(/^\/api\/providers\/(\d+)$/);
  if (detail) {
    const row = providers.find((p) => p.id === Number(detail[1]));
    if (!row) return json(404, { error: "not_found" });
    return json(200, row);
  }

  const portfolio = path.match(/^\/api\/providers\/(\d+)\/portfolio$/);
  if (portfolio) return json(200, []);

  return json(404, { error: "not_found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[dev-api] fixture Worker contract on http://127.0.0.1:${PORT}`);
  console.log("[dev-api] seed fixtures only — production always uses the real Worker.");
});
