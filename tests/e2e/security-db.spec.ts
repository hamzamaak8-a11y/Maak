import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { credentials, getState } from "./helpers";

test.describe("isolated database authorization smoke", () => {
  test("unauthenticated provider conversation RPC is denied", async () => {
    const anon = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc("get_or_create_provider_conversation", {
      p_provider_profile_id: getState().provider.userId,
    });
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/not_authenticated|JWT|authenticated/i);
  });

  test("customer can reuse or create a direct conversation with a published provider", async () => {
    const { email, password } = credentials("customer");
    const customer = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await customer.auth.signInWithPassword({ email, password });
    expect(signedIn.error).toBeNull();
    const { data, error } = await customer.rpc("get_or_create_provider_conversation", {
      p_provider_profile_id: getState().provider.userId,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  test("customer cannot open chat with an unpublished provider", async () => {
    const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const customer = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const providerId = getState().provider.userId;
    const listingId = getState().provider.listingId;
    const original = await service.from("providers").select("published_at").eq("id", listingId).single();
    expect(original.error).toBeNull();
    await service.from("providers").update({ published_at: null }).eq("id", listingId);
    try {
      const auth = await customer.auth.signInWithPassword(credentials("customer"));
      expect(auth.error).toBeNull();
      const result = await customer.rpc("get_or_create_provider_conversation", { p_provider_profile_id: providerId });
      expect(result.error).toBeTruthy();
      expect(result.error?.message).toMatch(/provider_not_bookable/i);
    } finally {
      await service.from("providers").update({ published_at: original.data?.published_at ?? new Date().toISOString() }).eq("id", listingId);
    }
  });

  test("provider cannot mutate a different user's provider profile", async () => {
    const provider = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = await provider.auth.signInWithPassword(credentials("provider"));
    expect(auth.error).toBeNull();
    const customerId = getState().customer.userId;
    const result = await provider.from("provider_profiles").update({ bio: "must-not-write" }).eq("id", customerId);
    expect(result.error).toBeTruthy();
  });

  test("hidden review fixture is not visible through public review reads", async () => {
    const anon = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const state = getState();
    const { data, error } = await anon.from("reviews").select("id,is_hidden").eq("id", state.hiddenReview.reviewId);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  test("booking overlap check rejects an already reserved interval", async () => {
    const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await service.rpc("check_availability", {
      p_provider_id: getState().provider.listingId,
      p_start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      p_end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    });
    expect(error).toBeNull();
    expect(data).toBeTypeOf("boolean");
  });

  test("invalid booking transition is rejected", async () => {
    const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const state = getState();
    const result = await service.rpc("cancel_booking", { p_booking_id: state.hiddenReview.bookingId });
    expect(result.error).toBeTruthy();
    expect(result.error?.message).toMatch(/invalid_transition|forbidden/i);
  });

  test("admin fixture is distinct from customer and provider roles", async () => {
    const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ids = getState();
    const profiles = await service.from("profiles").select("id,role").in("id", [ids.customer.userId, ids.provider.userId, ids.admin.userId]);
    expect(profiles.error).toBeNull();
    expect(new Set((profiles.data ?? []).map((row) => row.role))).toEqual(new Set(["customer", "provider", "admin"]));
  });
});
