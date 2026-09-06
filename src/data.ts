import { Hammer, Paintbrush, Sparkles, Truck, Wrench, Zap } from "lucide-react";
import type { Category } from "./types";

export const categories: Category[] = [
  { name: "السباكة", icon: Wrench, count: "" },
  { name: "الكهرباء", icon: Zap, count: "" },
  { name: "التنظيف", icon: Sparkles, count: "" },
  { name: "الصباغة", icon: Paintbrush, count: "" },
  { name: "النقل", icon: Truck, count: "" },
  { name: "الصيانة", icon: Hammer, count: "" },
];
