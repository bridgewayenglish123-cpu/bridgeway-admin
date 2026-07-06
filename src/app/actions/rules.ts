"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActiveStatus, TeacherType, BillingType } from "@/lib/supabase/types";

function uid() {
  return "pr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function createPriceRule(data: {
  price_rule_code: string;
  display_name: string;
  teacher_type: TeacherType;
  course_family: string;
  duration_type: string;
  billing_type: BillingType;
  lesson_count: number;
  price_ntd: number;
  teacher_payout_ntd: number;
  hanne_share_ntd: number;
  validity_days: number | null;
}) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("price_rules").insert({
    id: uid(),
    ...data,
    price_rule_code: data.price_rule_code.trim().toUpperCase(),
    display_name: data.display_name.trim(),
    active_status: "Active" as ActiveStatus,
    created_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };
  revalidatePath("/rules");
  return { ok: true };
}

export async function updatePriceRule(id: string, data: {
  display_name: string;
  teacher_type: TeacherType;
  course_family: string;
  duration_type: string;
  billing_type: BillingType;
  lesson_count: number;
  price_ntd: number;
  teacher_payout_ntd: number;
  hanne_share_ntd: number;
  validity_days: number | null;
}) {
  const supabase = createClient();
  const { error } = await supabase
    .from("price_rules")
    .update({ ...data, display_name: data.display_name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/rules");
  return { ok: true };
}

export async function togglePriceRule(id: string, status: ActiveStatus) {
  const supabase = createClient();
  const { error } = await supabase
    .from("price_rules")
    .update({ active_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/rules");
  return { ok: true };
}
