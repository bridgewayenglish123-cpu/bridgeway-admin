"use server";

// 時間字串轉分鐘數（"10:30" → 630）
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 判斷兩個課程是否時間重疊
function isTimeOverlap(
  time1: string, duration1: number,
  time2: string, duration2: number
): boolean {
  const start1 = timeToMinutes(time1);
  const end1 = start1 + duration1;
  const start2 = timeToMinutes(time2);
  const end2 = start2 + duration2;
  return start1 < end2 && start2 < end1;
}


import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { addDays } from "@/lib/utils";
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
    await supabase.from("enrollments").delete().eq("id", enrollmentId);
    return { error: acErr.message };
  }
  revalidatePath("/accounts");
  // 自動複製舊帳戶排課規則到新帳戶
  try {
    const { data: prevAccounts } = await supabase
      .from("accounts")
      .select("id")
      .eq("student_id", input.student_id)
      .eq("is_trial", false)
      .neq("id", accountId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (prevAccounts && prevAccounts.length > 0) {
      const prevAccId = prevAccounts[0].id;
      const { data: oldRules } = await supabase
        .from("schedule_rules")
        .select("*")
        .eq("account_id", prevAccId)
        .eq("active_status", "Active");

      if (oldRules && oldRules.length > 0) {
        const now2 = new Date().toISOString();

        // 續購自動接續:新帳戶從「該學生最後一堂已排課程」之後的
        // 下一個符合規則的日期開始,不與舊帳戶的課重疊。
        const { data: lastLesson } = await supabase
          .from("lessons")
          .select("date")
          .eq("student_id", input.student_id)
          .eq("is_active", true)
          .in("status", ["scheduled", "completed"])
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        let nextStart: string | null = null;
        if (lastLesson?.date) {
          const allWeekdays = new Set<number>();
          for (const r of oldRules as any[]) {
            for (const wd of (r.weekdays as number[]) || []) allWeekdays.add(wd);
          }
          let cursor = addDays(lastLesson.date, 1);
          for (let i = 0; i < 90; i++) {
            const wd = new Date(cursor + "T00:00:00").getDay();
            if (allWeekdays.has(wd)) {
              nextStart = cursor;
              break;
            }
            cursor = addDays(cursor, 1);
          }
        }

        const newRules = oldRules.map((r: any) => ({
          id: uid("sr"),
          account_id: accountId,
          teacher_id: r.teacher_id,
          weekdays: r.weekdays,
          time: r.time,
          duration: r.duration,
          start_date: null,
          end_date: null,
          active_status: "Active",
          created_at: now2,
          updated_at: now2,
        }));
        await supabase.from("schedule_rules").insert(newRules);
        await supabase
          .from("schedule_rules")
          .update({ active_status: "Inactive", updated_at: now2 })
          .eq("account_id", prevAccId);

        // 起始日寫入新帳戶(生成課程的唯一權威來源)
        if (nextStart) {
          await supabase
            .from("accounts")
            .update({ start_lesson_date: nextStart, updated_at: now2 })
            .eq("id", accountId);
        }
      }
    }
  } catch (_) {}

  return { ok: true, accountId };
}

export async function convertTrialToFull(accountId: string, input: OpenAccountInput) {
  // 不動試聽帳戶,只建立新的正式帳戶
  // 試聽帳戶完課後 accountStatus 自然回傳 "Completed",不需要手動關閉
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
  const { data: acc } = await supabase
    .from("accounts").select("enrollment_id").eq("id", accountId).single();
  await supabase.from("lessons").delete().eq("account_id", accountId);
  await supabase.from("schedule_rules").delete().eq("account_id", accountId);
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) return { error: error.message };
  if (acc?.enrollment_id) {
    await supabase.from("enrollments").delete().eq("id", acc.enrollment_id);
  }
  revalidatePath("/accounts");
  return { ok: true };
}

export async function cleanupOrphanAccounts(data: {
  accountIds: string[];
  enrollmentIds: string[];
}) {
  if (!data.accountIds.length) return { ok: true, deleted: 0 };
  const supabase = createClient();
  await supabase.from("lessons").delete().in("account_id", data.accountIds);
  await supabase.from("schedule_rules").delete().in("account_id", data.accountIds);
  const { error } = await supabase.from("accounts").delete().in("id", data.accountIds);
  if (error) return { error: error.message };
  if (data.enrollmentIds.length) {
    await supabase.from("enrollments").delete().in("id", data.enrollmentIds);
  }
  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true, deleted: data.accountIds.length };
}

export async function bookFlexLesson(data: {
  account_id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  time: string;
  duration: number;
  total_lessons: number;
  snapshot: {
    original_price_ntd: number;
    lesson_count: number;
    teacher_payout_ntd: number;
    hanne_share_ntd: number;
    lee_commission_ntd: number;
  };
}) {
  const supabase = createClient();

  // 1a. 同學生時段衝突(跨帳戶，含時長重疊檢查)
  const { data: studentLessons } = await supabase
    .from("lessons")
    .select("id,account_id,teacher_id,time,duration")
    .eq("student_id", data.student_id)
    .eq("is_active", true)
    .eq("date", data.date)
    .in("status", ["scheduled", "completed"]);

  const studentConflict = (studentLessons || []).find(l =>
    l.time && l.duration && isTimeOverlap(data.time, data.duration, l.time, l.duration)
  );

  if (studentConflict) {
    const { data: dupAcc } = await supabase
      .from("accounts").select("course_label").eq("id", studentConflict.account_id).single();
    const { data: dupTeacher } = await supabase
      .from("teachers").select("teacher_name").eq("id", studentConflict.teacher_id || "").single();
    const endTime = new Date(`2000-01-01T${data.time}`);
    endTime.setMinutes(endTime.getMinutes() + data.duration);
    const endStr = endTime.toTimeString().slice(0, 5);
    return {
      ok: false,
      error: "此學生在 " + data.date + " " + data.time + "–" + endStr + " 與另一堂課重疊:\n" +
        (dupAcc?.course_label || "另一帳戶") + " · " + studentConflict.time + " · " + (dupTeacher?.teacher_name || "未指派老師") +
        "\n\n請換時間,或先取消原本那堂。",
    };
  }

  // 1b. 同老師時段衝突
  if (data.teacher_id) {
    const { data: teacherLessons } = await supabase
      .from("lessons")
      .select("id,student_id,time,duration")
      .eq("teacher_id", data.teacher_id)
      .eq("is_active", true)
      .eq("date", data.date)
      .in("status", ["scheduled", "completed"]);

    const teacherConflict = (teacherLessons || []).find(l =>
      l.time && l.duration && isTimeOverlap(data.time, data.duration, l.time, l.duration)
    );

    if (teacherConflict) {
      const { data: dupStudent } = await supabase
        .from("students").select("zh_name").eq("id", teacherConflict.student_id).single();
      const { data: teacherData } = await supabase
        .from("teachers").select("teacher_name").eq("id", data.teacher_id).single();
      const endTime = new Date("2000-01-01T" + data.time);
      endTime.setMinutes(endTime.getMinutes() + data.duration);
      const endStr = endTime.toTimeString().slice(0, 5);
      const existEnd = new Date("2000-01-01T" + teacherConflict.time);
      existEnd.setMinutes(existEnd.getMinutes() + (teacherConflict.duration || 0));
      return {
        ok: false,
        error: (teacherData?.teacher_name || "此老師") + " 在 " + data.date + " 有時間重疊:\n" +
          "新課：" + data.time + "–" + endStr + "\n" +
          "已排：" + teacherConflict.time + "–" + existEnd.toTimeString().slice(0, 5) +
          " (" + (dupStudent?.zh_name || "未知") + ")\n\n請換時間或換老師。",
      };
    }
  }

  // 2. 帳戶內既有課程
  const { data: existing } = await supabase
    .from("lessons").select("id,date,time,class_type,status,is_active").eq("account_id", data.account_id);
  const active = (existing || []).filter((l) => l.is_active);

  // 3. 堂數上限
  // 與 generateLessonsForAccount / UI 對話框同一套算法:
  // completed + scheduled 全類型計入,cancelled 不算(已由 makeup/extension 取代)。
  // 舊版用 class_type === "general" 過濾且不看 status,會把已取消的課
  // 也算成佔用,導致誤判「已排滿」。
  const usedCount = active.filter(
    (l) => l.status === "completed" || l.status === "scheduled"
  ).length;
  if (usedCount >= data.total_lessons) {
    return {
      ok: false,
      error: "此帳戶已排滿 " + usedCount + "/" + data.total_lessons + " 堂。\n若想換時間,建議到「課程管理」取消某堂 → 選「加補課」會更順(自動處理堂數守恆)。",
    };
  }
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
  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}
