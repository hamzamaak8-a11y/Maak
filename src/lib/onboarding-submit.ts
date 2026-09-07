import { supabase } from "./supabaseClient";
import type { OnboardingPersonal, OnboardingProfessional } from "./onboarding";

export async function submitProviderOnboarding(
  personal: OnboardingPersonal,
  professional: OnboardingProfessional,
): Promise<void> {
  const { error } = await supabase.rpc("submit_provider_onboarding", {
    p_full_name: personal.full_name.trim(),
    p_phone: personal.phone.trim(),
    p_city: personal.city.trim(),
    p_profession: professional.profession.trim(),
    p_service_category: professional.service_category,
    p_bio: professional.bio.trim(),
    p_experience_years: professional.experience_years.trim() === "" ? null : Number(professional.experience_years),
    p_services: professional.services.length ? professional.services : null,
    p_price_from: professional.price_from.trim() === "" ? null : Number(professional.price_from),
    p_service_radius_km: professional.service_radius_km.trim() === "" ? null : Number(professional.service_radius_km),
  });
  if (error) throw error;
}
