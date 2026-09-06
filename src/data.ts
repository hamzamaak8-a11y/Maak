import { Hammer, Paintbrush, Sparkles, Truck, Wrench, Zap } from "lucide-react";
import type { Category, Provider } from "./types";

export const categories: Category[] = [
  { name: "السباكة", icon: Wrench, count: "" },
  { name: "الكهرباء", icon: Zap, count: "" },
  { name: "التنظيف", icon: Sparkles, count: "" },
  { name: "الصباغة", icon: Paintbrush, count: "" },
  { name: "النقل", icon: Truck, count: "" },
  { name: "الصيانة", icon: Hammer, count: "" },
];

export const fallbackProviders: Provider[] = [
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
    services: ["إصلاح التسربات", "تركيب الصنابر", "صيانة السخانات"],
    experience: "8 سنوات",
    intro:
      "كنعاون العائلات فطنجة نحلّو مشاكل الماء بسرعة وبخدمة نقية. كنشرح المشكل قبل أي تدخل.",
    listing_kind: "real",
    provider_profile_id: "demo-1",
    published_at: "2026-01-01T00:00:00Z",
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
      "خدمة تنظيف منظمة وموثوقة، نهتم بالتفاصيل ونخليو دارك مرتبة ومرتاحة.",
    listing_kind: "real",
    provider_profile_id: "demo-2",
    published_at: "2026-01-01T00:00:00Z",
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
      "كنقدمو حلول كهربائية آمنة للمنازل والمحلات بطنجة، من التشخيص حتى الإصلاح.",
    listing_kind: "real",
    provider_profile_id: "demo-3",
    published_at: "2026-01-01T00:00:00Z",
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
    intro: "نقل الأثاث بلا صداع، من الباب للباب وبعناية.",
    listing_kind: "real",
    provider_profile_id: "demo-4",
    published_at: "2026-01-01T00:00:00Z",
  },
];
