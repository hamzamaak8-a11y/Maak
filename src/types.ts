export type Role = 'customer' | 'provider' | 'admin';
export type AccountStatus = 'active' | 'suspended';
export type VerificationStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
export type BookingStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'in_progress' | 'completed';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';
export type Lang = 'ar' | 'fr' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  account_status: AccountStatus;
  created_at: string;
  updated_at: string;
};

/** Public marketplace listing, served by the read API. */
export type Provider = {
  id: number;
  name: string;
  job: string;
  city: string;
  price: string | null;
  rating: string | null;
  reviews: number;
  image: string | null;
  available: boolean | null;
  services: string[];
  experience: string | null;
  intro: string | null;
  provider_profile_id: string | null;
  category: string | null;
  /** Server-confirmed: approved provider with an active account. Never assume it. */
  verified: boolean;
  /** Currency of the provider's price list; null when unknown. */
  currency: string | null;
};

export type ProviderProfile = {
  id: string;
  profession: string | null;
  service_category: string | null;
  bio: string | null;
  experience_years: number | null;
  services: string[] | null;
  price_from: number | null;
  service_radius_km: number | null;
  profile_photo_public: boolean;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ProviderDocument = {
  id: string;
  provider_id: string;
  document_type: string;
  storage_path: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export type Booking = {
  id: string;
  customer_id: string;
  provider_id: string;
  provider_listing_id: number | null;
  service_category: string;
  service_description: string;
  service_date: string | null;
  location_text: string | null;
  customer_note: string;
  provider_note: string;
  status: BookingStatus;
  rejection_reason: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  price: number | null;
  currency: string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  paid_at: string | null;
};

export type Review = {
  id: string;
  booking_id: string;
  customer_id: string | null;
  provider_id: string;
  rating: number;
  comment: string | null;
  is_hidden: boolean;
  created_at: string;
};

export type ReviewsSummary = { average_rating: number; total_count: number; reviews: Review[] };

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export type ProviderService = {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Availability = {
  id: string;
  provider_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

export type Conversation = {
  conversation_id: string;
  booking_id: string | null;
  other_user_id: string;
  other_user_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type ChatMessage = { id: string; sender_id: string; body: string; created_at: string; read_at: string | null };

export type ProviderDashboardStats = {
  total_completed_bookings: number;
  total_earnings: number | null;
  total_earnings_currency: string | null;
  average_rating: number;
  total_reviews: number;
  upcoming_bookings: Array<{
    id: string;
    customer_name: string;
    service_category: string;
    service_description: string;
    service_date: string;
    location_text: string | null;
    status: 'pending' | 'accepted';
    created_at: string;
    price: number | null;
    currency: string;
    payment_status: PaymentStatus;
  }>;
  recent_activity: AppNotification[];
};

export type PortfolioImage = { id: string; path: string; url: string; created_at: string | null };
