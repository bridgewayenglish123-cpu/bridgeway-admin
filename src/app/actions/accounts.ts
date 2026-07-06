"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TeacherType, BillingType } from "@/lib/supabase/types";

function uid(prefix = "ac") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface OpenAccountInput {
  student_id: string;
  course_label: string;
  teacher_type: TeacherType;
  course_family: string;
  duration_type: string;
  billing_type: BillingType;
  total_lessons: number;
  is_trial: boolean;
  price_rule_code: string;
  payment_date: string;
  note: string;
  snapshot: {
    original_price_ntd: number;
    lesson_count: number;
    teacher_payout_ntd: number;
    hanne_share_ntd: number;
    lee_commission_ntd: number;
  };
}

export async function openAccount(input: OpenAccountInput) {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 1. 建立 enrollment
  const enrollmentId = uid("en");
  const { error: enErr } = await supabase.from("enrollments").insert({
    id: enrollmentId,
    student_id: input.student_id,
    price_rule_code: input.price_rule_code || null,
    payment_date: input.payment_date,
    note: input.note || null,
    snapshot: input.snapshot,
    created_at: now,
    updated_at: now,
  });
  if (enErr) return { error: enErr.message };

  // 2. 建立 account
  const accountId = uid("ac");
  const { error: acErr } = await supabase.from("accounts").insert({
    id: accountId,
    enrollment_id: enrollmentId,
    student_id: input.student_id,
    course_label: input.course_label.trim(),
    teacher_type: input.teacher_type,
    course_family: input.course_family,
    duration_type: input.duration_type,
    billing_type: input.billing_type,
    total_lessons: input.total_lessons,
    is_trial: input.is_trial,
    start_lesson_date: null,
    valid_until: null,
    snapshot: input.snapshot,
    status_override: null,
    created_at: now,
    updated_at: now,
  });
  if (acErr) {
    // rollback enrollment
    await supabase.from("enrollments").delete().eq("id", enrollmentId);
    return { error: acErr.message };
  }

  revalidatePath("/accounts");
  return { ok: true, accountId };
}

export async function convertTrialToFull(
  accountId: string,
  input: OpenAccountInput
) {
  // 試聽轉正:關閉舊試聽帳戶 + 開新正式帳戶
  const supabase = createClient();
  const { error: closeErr } = await supabase
    .from("accounts")
    .update({ status_override: "Closed", updated_at: new Date().toISOString() })
    .eq("id", accountId);
  if (closeErr) return { error: closeErr.message };

  return openAccount({ ...input, is_trial: false });
}

export async function closeAccount(accountId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ status_override: "Closed", updated_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}

export async function reopenAccount(accountId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ status_override: null, updated_at: new Date().toISOString() })
    .eq("id", accountId);
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}

export async function deleteAccount(accountId: string) {
  const supabase = createClient();

  // 取得 account
  const { data: acc } = await supabase
    .from("accounts").select("enrollment_id").eq("id", accountId).single();

  // 刪課程
  await supabase.from("lessons").delete().eq("account_id", accountId);
  // 刪排課規則
  await supabase.from("schedule_rules").delete().eq("account_id", accountId);
  // 刪帳戶
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) return { error: error.message };
  // 刪 enrollment
  if (acc?.enrollment_id) {
    await supabase.from("enrollments").delete().eq("id", acc.enrollment_id);
  }

  revalidatePath("/accounts");
  return { ok: true };
}

export async function bookFlexLesson(data: {
  account_id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  time: string;
  duration: number;
  snapshot: {
    original_price_ntd: number;
    lesson_count: number;
    teacher_payout_ntd: number;
    hanne_share_ntd: number;
    lee_commission_ntd: number;
  };
}) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("lessons").insert({
    id: uid("ls"),
    account_id: data.account_id,
    student_id: data.student_id,
    teacher_id: data.teacher_id,
    schedule_rule_id: null,
    date: data.date,
    time: data.time,
    duration: data.duration,
    class_type: "general",
    status: "scheduled",
    is_active: true,
    is_backfill: false,
    original_class_id: null,
    original_payout_snapshot: null,
    is_substitute: false,
    original_teacher_id: null,
    payout_snapshot: data.snapshot,
    note: "彈性排課",
    superseded: false,
    created_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}
