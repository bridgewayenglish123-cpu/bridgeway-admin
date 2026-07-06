"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayYMD } from "@/lib/utils";

function uid(prefix = "re") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function markPaid(periodKey: string, paid: boolean) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("remittance_periods")
    .upsert(
      {
        period_key: periodKey,
        paid,
        paid_date: paid ? todayYMD() : null,
        updated_at: now,
        created_at: now,
      },
      { onConflict: "period_key" }
    );
  if (error) return { error: error.message };
  revalidatePath("/remit");
  return { ok: true };
}

export async function addExtra(data: {
  period_key: string;
  teacher_id: string | null;
  amount_php: number;
  note: string;
  date: string;
  php_rate: number;
}) {
  if (data.amount_php <= 0) return { error: "金額必須大於 0" };
  const supabase = createClient();
  const now = new Date().toISOString();
  const amount_ntd = Math.round(data.amount_php / data.php_rate);
  const { error } = await supabase.from("remittance_extras").insert({
    id: uid("rx"),
    period_key: data.period_key,
    teacher_id: data.teacher_id || null,
    amount_php: data.amount_php,
    amount_ntd,
    note: data.note.trim() || null,
    date: data.date,
    created_at: now,
  });
  if (error) return { error: error.message };
  revalidatePath("/remit");
  return { ok: true };
}

export async function deleteExtra(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("remittance_extras").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/remit");
  return { ok: true };
}

export async function updatePhpRate(rate: number) {
  if (!rate || rate <= 0) return { error: "匯率必須大於 0" };
  const supabase = createClient();
  const { error } = await supabase
    .from("app_meta")
    .update({ php_rate: rate, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/remit");
  revalidatePath("/");
  return { ok: true };
}
