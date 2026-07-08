"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { todayYMD, addDays, fmt } from "@/lib/utils";
import type { ActiveStatus } from "@/lib/supabase/types";

function uid(prefix = "sr") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── 新增單條規則 ───────────────────────────────────────────────────────────────
export async function createScheduleRule(data: {
  account_id: string;
  teacher_id: string | null;
  weekdays: number[];
  time: string;
  duration: number;
  start_date: string | null;
  end_date: string | null;
}) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("schedule_rules").insert({
    id: uid("sr"),
    account_id: data.account_id,
    teacher_id: data.teacher_id || null,
    weekdays: data.weekdays,
    time: data.time,
    duration: data.duration,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    active_status: "Active" as ActiveStatus,
    batch_id: null,
    created_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };
  revalidatePath("/schedule");
  return { ok: true };
}

// ── 更新規則 ───────────────────────────────────────────────────────────────────
export async function updateScheduleRule(id: string, data: {
  account_id: string;
  teacher_id: string | null;
  weekdays: number[];
  time: string;
  duration: number;
  start_date: string | null;
  end_date: string | null;
}) {
  const supabase = createClient();
  const { error } = await supabase
    .from("schedule_rules")
    .update({
      account_id: data.account_id,
      teacher_id: data.teacher_id || null,
      weekdays: data.weekdays,
      time: data.time,
      duration: data.duration,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/schedule");
  return { ok: true };
}

// ── 停用 / 啟用 ────────────────────────────────────────────────────────────────
export async function toggleScheduleRule(id: string, status: ActiveStatus) {
  const supabase = createClient();
  const { error } = await supabase
    .from("schedule_rules")
    .update({ active_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/schedule");
  return { ok: true };
}

// ── 刪除規則 ───────────────────────────────────────────────────────────────────
export async function deleteScheduleRule(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("schedule_rules").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/schedule");
  return { ok: true };
}

// ── 批次新增規則 ───────────────────────────────────────────────────────────────
export async function createBatchScheduleRules(items: {
  account_id: string;
  teacher_id: string | null;
  weekdays: number[];
  time: string;
  duration: number;
  start_date: string | null;
  end_date: string | null;
}[]) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const batchId = uid("bt");
  const inserts = items.map((item) => ({
    id: uid("sr"),
    account_id: item.account_id,
    teacher_id: item.teacher_id || null,
    weekdays: item.weekdays,
    time: item.time,
    duration: item.duration,
    start_date: item.start_date || null,
    end_date: item.end_date || null,
    active_status: "Active" as ActiveStatus,
    batch_id: batchId,
    created_at: now,
    updated_at: now,
  }));
  const { error } = await supabase.from("schedule_rules").insert(inserts);
  if (error) return { error: error.message };
  revalidatePath("/schedule");
  return { ok: true, batchId };
}

// ── 生成課程核心邏輯 ───────────────────────────────────────────────────────────
export async function generateLessonsForAccount(accountId: string): Promise<{
  ok?: boolean;
  added?: number;
  skipped?: string[];
  error?: string;
}> {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 取帳戶
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (!account) return { error: "找不到帳戶" };

  // 取生效規則
  const { data: rules } = await supabase
    .from("schedule_rules")
    .select("*")
    .eq("account_id", accountId)
    .eq("active_status", "Active");
  if (!rules || rules.length === 0) return { ok: true, added: 0 };

  // 取現有課程
  const { data: existingLessons } = await supabase
    .from("lessons")
    .select("id,date,time,class_type,status,is_active")
    .eq("account_id", accountId);

  const activeLessons = (existingLessons || []).filter((l) => l.is_active);
  const generalCount = activeLessons.filter((l) => l.class_type === "general").length;
  const remaining = account.total_lessons - generalCount;
  if (remaining <= 0) return { ok: true, added: 0 };

  // 已存在的日期+時間 set(避免重複)
  const existingKeys = new Set(
    activeLessons.map((l) => l.date + "__" + l.time)
  );

  // 起始日:直接用規則的 start_date，沒填則從今天
  // 允許過去日期(補錄歷史課程用)
  const today = todayYMD();
  const ruleStartDates = rules.map((r) => r.start_date).filter(Boolean) as string[];
  const startDate = ruleStartDates.length > 0
    ? ruleStartDates.reduce((a, b) => a < b ? a : b)
    : today;


  // 預先載入所有衝突資料(跨學生老師衝突)
  const { data: allLessonsForConflict } = await supabase
    .from("lessons")
    .select("id,student_id,teacher_id,date,time")
    .eq("is_active", true);

  // teacherBusy: teacher_id + date + time → 學生名
  const teacherBusyMap = new Map<string, string>();
  for (const l of allLessonsForConflict || []) {
    if (l.teacher_id) {
      teacherBusyMap.set(l.teacher_id + "__" + l.date + "__" + l.time, l.student_id);
    }
  }

  const skipped: string[] = [];

  // 迭代日期生成
  const toInsert: object[] = [];
  let cursor = startDate;
  const MAX_DAYS = 365;
  let dayCount = 0;
  let added = 0;

  while (added < remaining && dayCount < MAX_DAYS) {
    const cursorDate = new Date(cursor + "T00:00:00");
    const weekday = cursorDate.getDay();

    // 找符合此日期的規則(只看週幾,不用日期範圍)
    const matchingRules = rules.filter((r) => {
      return (r.weekdays as number[]).includes(weekday);
    });

    for (const rule of matchingRules) {
      if (added >= remaining) break;
      const key = cursor + "__" + rule.time;
      if (existingKeys.has(key)) continue;

      // 同學生時段衝突 → 跳過
      const studentKey = account.student_id + "__" + cursor + "__" + rule.time;
      if (existingKeys.has("student__" + studentKey)) {
        skipped.push(cursor + " " + rule.time + " (學生已有課)");
        continue;
      }

      // 同老師時段衝突 → 跳過
      if (rule.teacher_id) {
        const teacherKey = rule.teacher_id + "__" + cursor + "__" + rule.time;
        if (teacherBusyMap.has(teacherKey)) {
          skipped.push(cursor + " " + rule.time + " (老師已有課)");
          continue;
        }
        teacherBusyMap.set(teacherKey, account.student_id);
      }

      existingKeys.add(key);
      existingKeys.add("student__" + studentKey);
      toInsert.push({
        id: uid("ls"),
        account_id: accountId,
        student_id: account.student_id,
        teacher_id: rule.teacher_id,
        schedule_rule_id: rule.id,
        date: cursor,
        time: rule.time,
        duration: rule.duration,
        class_type: "general",
        status: "scheduled",
        is_active: true,
        is_backfill: false,
        original_class_id: null,
        original_payout_snapshot: null,
        is_substitute: false,
        original_teacher_id: null,
        payout_snapshot: account.snapshot,
        note: null,
        superseded: false,
        created_at: now,
        updated_at: now,
      });
      added++;
    }

    // 下一天
    cursor = addDays(cursor, 1);
    dayCount++;
  }

  if (toInsert.length === 0) return { ok: true, added: 0 };

  // 批次寫入
  const CHUNK = 50;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from("lessons").insert(chunk as any);
    if (error) return { error: error.message };
  }

  // 更新 start_lesson_date
  const allDates = toInsert.map((l: any) => l.date).sort();
  if (allDates.length > 0 && !account.start_lesson_date) {
    await supabase
      .from("accounts")
      .update({ start_lesson_date: allDates[0], updated_at: now })
      .eq("id", accountId);
  }

  revalidatePath("/schedule");
  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true, added, skipped };
}

// ── 一次生成全部 ───────────────────────────────────────────────────────────────
export async function generateAll(): Promise<{
  ok?: boolean;
  totalAdded?: number;
  accountCount?: number;
  error?: string;
}> {
  const supabase = createClient();

  // 找所有有生效規則的帳戶
  const { data: rules } = await supabase
    .from("schedule_rules")
    .select("account_id")
    .eq("active_status", "Active");

  if (!rules || rules.length === 0) return { ok: true, totalAdded: 0, accountCount: 0 };

  const accountIds = [...new Set(rules.map((r) => r.account_id))];
  let totalAdded = 0;

  for (const accountId of accountIds) {
    const res = await generateLessonsForAccount(accountId);
    if (res.ok) totalAdded += res.added || 0;
  }

  revalidatePath("/schedule");
  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true, totalAdded, accountCount: accountIds.length };
}

// ── 清理孤兒規則 ───────────────────────────────────────────────────────────────
export async function deleteOrphanRules(): Promise<{ ok?: boolean; deleted?: number; error?: string }> {
  const supabase = createClient();

  const { data: rules } = await supabase.from("schedule_rules").select("id,account_id");
  const { data: accounts } = await supabase.from("accounts").select("id");
  if (!rules || !accounts) return { error: "查詢失敗" };

  const accountIds = new Set(accounts.map((a) => a.id));
  const orphanIds = rules.filter((r) => !accountIds.has(r.account_id)).map((r) => r.id);

  if (orphanIds.length === 0) return { ok: true, deleted: 0 };

  const { error } = await supabase.from("schedule_rules").delete().in("id", orphanIds);
  if (error) return { error: error.message };

  revalidatePath("/schedule");
  return { ok: true, deleted: orphanIds.length };
}

// ── 清除待上課程並重新生成 ────────────────────────────────────────────────────
export async function clearAndRegenerate(accountId: string): Promise<{
  ok?: boolean;
  deleted?: number;
  added?: number;
  error?: string;
}> {
  const supabase = createClient();

  // 只刪除 scheduled(待上)的課程，不動已完成/已取消的
  const { data: toDelete, error: fetchErr } = await supabase
    .from("lessons")
    .select("id")
    .eq("account_id", accountId)
    .eq("is_active", true)
    .eq("status", "scheduled");

  if (fetchErr) return { error: fetchErr.message };

  const deleteIds = (toDelete || []).map((l) => l.id);

  if (deleteIds.length > 0) {
    const { error: delErr } = await supabase
      .from("lessons")
      .delete()
      .in("id", deleteIds);
    if (delErr) return { error: delErr.message };
  }

  // 重新生成
  const genResult = await generateLessonsForAccount(accountId);
  if (genResult.error) return { error: genResult.error };

  revalidatePath("/schedule");
  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true, deleted: deleteIds.length, added: genResult.added || 0 };
}
