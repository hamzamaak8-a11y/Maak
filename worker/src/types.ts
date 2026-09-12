export type Provider = {
  id: number;
  name: string;
  job: string;
  city: string;
  distance: string | null;
  price: string | null;
  rating: string | null;
  reviews: number;
  image: string | null;
  available: boolean | null;
  services: string[];
  experience: string | null;
  intro: string | null;
  provider_profile_id: string | null;
  listing_kind: "seed" | "real" | null;
  published_at: string | null;
  is_featured: boolean;
};

export type ProviderPortfolioImage = {
  id: string;
  path: string;
  url: string;
  created_at: string | null;
  content_type: string | null;
  size: number | null;
};

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  MAAK_ALLOW_ORIGIN: string;
}
