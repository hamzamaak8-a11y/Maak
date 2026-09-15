export type NativeProvider = {
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
  listing_kind: 'seed' | 'real' | null;
  published_at: string | null;
  is_featured: boolean;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export async function fetchProviders(): Promise<NativeProvider[]> {
  if (!API_URL) return [];
  const res = await fetch(`${API_URL}/api/providers`);
  if (!res.ok) throw new Error('تعذر تحميل مقدمي الخدمات');
  return (await res.json()) as NativeProvider[];
}

export async function fetchProvider(id: string): Promise<NativeProvider | null> {
  if (!API_URL) return null;
  const res = await fetch(`${API_URL}/api/providers/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('تعذر تحميل مقدم الخدمة');
  return (await res.json()) as NativeProvider;
}
