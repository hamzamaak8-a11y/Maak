import type { Provider } from "./types";

// The 4 providers (verbatim from the previous backend seed). Single source of
// truth for POST /admin/seed; nothing in the UI imports this.
export const seedProviders: Provider[] = [
  {
    id: 1,
    name: "محمد العلوي",
    job: "سباك محترف",
    city: "طنجة",
    distance: "2.4 كم",
    price: "ابتداءً من 100 درهم",
    rating: "4.9",
    reviews: 128,
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=85",
    available: true,
    services: ["إصلاح التسربات", "تركيب الصنابير", "صيانة السخانات"],
    experience: "8 سنوات",
    intro:
      "أساعد العائلات في طنجة على حل مشاكل المياه والسباكة بسرعة وجودة متقنة، مع توضيح أسباب العطل والحلول المناسبة قبل أي تدخل.",
    provider_profile_id: null,
    listing_kind: "seed",
    published_at: null,
  },
  {
    id: 2,
    name: "سلمى بنعتيى",
    job: "تنظيف المنازل",
    city: "طنجة",
    distance: "3.1 كم",
    price: "ابتداءً من 150 درهم",
    rating: "4.8",
    reviews: 74,
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=240&q=85",
    available: true,
    services: ["تنظيف شامل", "تنظيف بعد الانتقال"],
    experience: "5 سنوات",
    intro:
      "خدمة تنظيف منظمة وموثوقة بعناية فائقة لكافة التفاصيل لضمان بيئة منزلية مريحة ونظيفة.",
    provider_profile_id: null,
    listing_kind: "seed",
    published_at: null,
  },
  {
    id: 3,
    name: "ياسين المرابط",
    job: "كهربائي معتمد",
    city: "طنجة",
    distance: "4.7 كم",
    price: "ابتداءً من 120 درهم",
    rating: "4.9",
    reviews: 92,
    image:
      "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=240&q=85",
    available: false,
    services: ["تركيب الإنارة", "إصلاح الأعطال", "لوحات الكهرباء"],
    experience: "11 سنة",
    intro:
      "نقدم حلولاً كهربائية آمنة ومعتمدة للمنازل والمحلات بطنجة، من التشخيص الدقيق وحتى الصيانة والإصلاح الكامل.",
    provider_profile_id: null,
    listing_kind: "seed",
    published_at: null,
  },
  {
    id: 4,
    name: "عمر التازي",
    job: "نقل وتركيب",
    city: "تطوان",
    distance: "12 كم",
    price: "ابتداءً من 250 درهم",
    rating: "4.7",
    reviews: 51,
    image:
      "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=240&q=85",
    available: true,
    services: ["نقل الأثاث", "التركيب", "التغليف"],
    experience: "6 سنوات",
    intro: "نقل احترافي للأثاث بكل عناية وأمان من الباب إلى الباب مع خدمات التغليف والتركيب الدقيق.",
    provider_profile_id: null,
    listing_kind: "seed",
    published_at: null,
  },
];
