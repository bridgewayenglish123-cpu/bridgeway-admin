import { createClient } from "@/lib/supabase/server";
import type { Teacher, Account, Lesson, RemittancePeriod, RemittanceExtra } from "@/lib/supabase/types";
import RemitClient from "./RemitClient";

async function loadData() {
  const supabase = createClient();
  const [teachersRes, accountsRes, lessonsRes, remitRes, extrasRes, metaRes] = await Promise.all([
    supabase.from("teachers").select("*"),
    supabase.from("accounts").select("*"),
    supabase.from("lessons").select("*"),
    supabase.from("remittance_periods").select("*"),
    supabase.from("remittance_extras").select("*").order("date"),
    supabase.from("app_meta").select("*").eq("id", 1).single(),
  ]);
  return {
    teachers: (teachersRes.data || []) as Teacher[],
    accounts: (accountsRes.data || []) as Account[],
    lessons: (lessonsRes.data || []) as Lesson[],
    periods: (remitRes.data || []) as RemittancePeriod[],
    extras: (extrasRes.data || []) as RemittanceExtra[],
    phpRate: (metaRes.data?.php_rate || 1.8) as number,
  };
}

export default async function RemitPage() {
  const data = await loadData();
  return <RemitClient {...data} />;
}
