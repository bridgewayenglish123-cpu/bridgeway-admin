"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { addDays } from "@/lib/utils";
import type { LessonStatus, ClassType, PayoutSnapshot } from "@/lib/supabase/types";

function uid(prefix = "ls") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * 找出下一個可用的排課時段。
 *
 * 規則:從 fromDate 隔天開始往後找,回傳第一個「符合排課規則週幾」
 * 且「該學生在該日期時間沒有其他課」的時段。
 *
 * 為什麼從 fromDate 之後找而非排到最後面:學生視角是一條連續時間線,
 * 中間若有空位(例如續購起始日跳過的那週)應優先填補,
 * 而不是把課推到所有已排課程之後。
 *
 * 為什麼衝突檢查用 student_id 而非 account_id:同一學生可能同時持有
 * 多個帳戶(第一次購課未上完就續購),只檢查單一帳戶會排出重疊的課。
 */
async function findNextAvailableSlot(
  supabase: any,
  studentId: string,
  rules: { weekdays: number[] | unknown; time: string }[],
  fromDate: string,
  maxDays = 90
): Promise<{ date: string; time: string } | null> {
  if (!rules || rules.length === 0) return null;

  // 一次載入該學生所有已排/已完成課程,避免迴圈內逐日查詢
  const { data: occupied } = await supabase
    .from("lessons")
    .select("date, time")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .in("status", ["scheduled", "completed"]);

  const taken = new Set(
    (occupied || []).map((l: any) => l.date + "__" + l.time)
  );

  let cursor = addDays(fromDate, 1);
  for (let i = 0; i < maxDays; i++) {
    const wd = new Date(cursor + "T00:00:00").getDay();
    const match = rules.find((r) => (r.weekdays as number[]).includes(wd));
    if (match && !taken.has(cursor + "__" + match.time)) {
      return { date: cursor, time: match.time };
    }
    cursor = addDays(cursor, 1);
  }
  return null;
}

// ── 標記完成 ──────────────────────────────────────────────────────────────────
export async function markLessonCompleted(lessonId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true };
}

export async function markLessonsCompleted(lessonIds: string[]) {
  if (!lessonIds.length) return { ok: true };
  const supabase = createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .in("id", lessonIds);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true };
}

// ── 復原為待上 ────────────────────────────────────────────────────────────────
export async function revertLessonToScheduled(lessonId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 1. 改回 scheduled
  const { error } = await supabase
    .from("lessons")
    .update({ status: "scheduled", updated_at: now })
    .eq("id", lessonId);
  if (error) return { error: error.message };

  // 2. 刪除因此取消而產生的延伸課
  await supabase
    .from("lessons")
    .delete()
    .eq("original_class_id", lessonId)
    .eq("class_type", "extension")
    .eq("is_active", true);

  revalidatePath("/lessons");
  revalidatePath("/remit");
  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true };
}

/**
 * 預覽:若取消這堂課,延伸課會排到哪一天。
 * 供 CancelModal 在使用者按下確認前顯示,避免「按了才知道排到哪」。
 * 回傳 null 表示不會產生延伸課(非 general、無排課規則、或 90 天內找不到空位)。
 */
export async function previewExtensionSlot(lessonId: string): Promise<{
  date?: string;
  time?: string;
  weekdayLabel?: string;
  reason?: string;
}> {
  const supabase = createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("account_id, student_id, date, class_type")
    .eq("id", lessonId)
    .single();
  if (!lesson) return { reason: "找不到課程" };

  if (lesson.class_type !== "general") {
    return { reason: "補課/延伸課取消後不再產生延伸" };
  }

  // 規則查該「學生」所有帳戶,而非只查這堂課所屬帳戶。
  // 續購後規則會搬到新帳戶,但舊帳戶可能仍有未上完的課;
  // 只查單一帳戶會誤判成「無排課規則」。
  const { data: stuAccounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("student_id", lesson.student_id);

  const accIds = (stuAccounts || []).map((a: any) => a.id);
  const { data: rules } = await supabase
    .from("schedule_rules")
    .select("weekdays, time")
    .in("account_id", accIds.length > 0 ? accIds : [lesson.account_id])
    .eq("active_status", "Active");

  if (!rules || rules.length === 0) {
    return { reason: "此學生無生效排課規則(彈性預約),不會自動延伸" };
  }

  const slot = await findNextAvailableSlot(
    supabase,
    lesson.student_id,
    rules as any,
    lesson.date
  );
  if (!slot) {
    return {
      reason:
        "90 天內找不到可用時段 [debug: rules=" +
        JSON.stringify(rules) +
        " from=" + lesson.date + "]",
    };
  }

  const WD = ["日", "一", "二", "三", "四", "五", "六"];
  const wd = new Date(slot.date + "T00:00:00").getDay();
  return { date: slot.date, time: slot.time, weekdayLabel: "週" + WD[wd] };
}

// ── 取消課程 ──────────────────────────────────────────────────────────────────
// makeup = null  →  只取消 + 建自動延伸(+7天 extension)
// makeup = {date, time}  →  取消 + 建 makeup,讓延伸 inactive
export async function cancelLesson(
  lessonId: string,
  makeup: { date: string; time: string; teacherId?: string | null; note?: string | null } | null = null
) {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 取得原課程
  const { data: lesson, error: fetchErr } = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .single();
  if (fetchErr || !lesson) return { error: "找不到課程" };

  // 標記取消
  const { error: cancelErr } = await supabase
    .from("lessons")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", lessonId);
  if (cancelErr) return { error: cancelErr.message };

  // makeup 衝突預檢(在建立之前)
  if (makeup) {
    // 同學生時段衝突
    const { data: studentConflict } = await supabase
      .from("lessons")
      .select("id,account_id,teacher_id")
      .eq("student_id", lesson.student_id)
      .eq("is_active", true)
      .eq("date", makeup.date)
      .eq("time", makeup.time);

    if (studentConflict && studentConflict.length > 0) {
      const conf = studentConflict[0];
      const { data: confAcc } = await supabase
        .from("accounts").select("course_label").eq("id", conf.account_id).single();
      const { data: confTeacher } = await supabase
        .from("teachers").select("teacher_name").eq("id", conf.teacher_id || "").single();
      return {
        error: `此學生在 ${makeup.date} ${makeup.time} 已有另一堂課:\n${confAcc?.course_label || "另一帳戶"} · ${confTeacher?.teacher_name || "未指派老師"}\n\n請換補課時間。`,
      };
    }

    // 同老師時段衝突
    const makeupTeacherId = makeup.teacherId || lesson.teacher_id;
    if (makeupTeacherId) {
      const { data: teacherConflict } = await supabase
        .from("lessons")
        .select("id,student_id")
        .eq("teacher_id", makeupTeacherId)
        .eq("is_active", true)
        .eq("date", makeup.date)
        .eq("time", makeup.time);

      if (teacherConflict && teacherConflict.length > 0) {
        const tConf = teacherConflict[0];
        const { data: confStudent } = await supabase
          .from("students").select("zh_name").eq("id", tConf.student_id).single();
        const { data: teacher } = await supabase
          .from("teachers").select("teacher_name").eq("id", makeupTeacherId).single();
        return {
          error: `${teacher?.teacher_name || "此老師"} 在 ${makeup.date} ${makeup.time} 已排另一堂:\n學生:${confStudent?.zh_name || "未知"}\n\n請換補課時間或換老師。`,
        };
      }
    }
  }

  if (!makeup) {
    // makeup/extension 取消 → 不產生延伸
    // general 且有排課規則 → 找下一個規則時段延伸
    // general 且無排課規則(彈性排課) → 不產生延伸
    const isGeneral = lesson.class_type === "general";
    if (isGeneral) {
      // 同 previewExtensionSlot:規則查該學生所有帳戶
      const { data: stuAccounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("student_id", lesson.student_id);
      const accIds = (stuAccounts || []).map((a: any) => a.id);

      const { data: rules } = await supabase
        .from("schedule_rules")
        .select("id, weekdays, time")
        .in("account_id", accIds.length > 0 ? accIds : [lesson.account_id])
        .eq("active_status", "Active");

      let extDate: string | null = null;
      let extTime: string | null = null;

      if (rules && rules.length > 0) {
        const slot = await findNextAvailableSlot(
          supabase,
          lesson.student_id,
          rules as any,
          lesson.date
        );
        if (slot) {
          extDate = slot.date;
          extTime = slot.time;
        }
      }

      if (extDate) {
        const { error: extErr } = await supabase.from("lessons").insert({
          id: uid("ls"),
          account_id: lesson.account_id,
          student_id: lesson.student_id,
          teacher_id: lesson.teacher_id,
          schedule_rule_id: null,
          date: extDate,
          time: extTime || lesson.time,
          duration: lesson.duration,
          class_type: "extension" as ClassType,
          status: "scheduled" as LessonStatus,
          is_active: true,
          is_backfill: false,
          original_class_id: lessonId,
          original_payout_snapshot: null,
          is_substitute: false,
          original_teacher_id: null,
          payout_snapshot: lesson.payout_snapshot,
          note: `自動延伸(原課 ${lesson.date})`,
          superseded: false,
          created_at: now,
          updated_at: now,
        });
        if (extErr) return { error: extErr.message };
      }
    }
  } else {
    // 建 makeup
    const { error: mkErr } = await supabase.from("lessons").insert({
      id: uid("ls"),
      account_id: lesson.account_id,
      student_id: lesson.student_id,
      teacher_id: makeup.teacherId || lesson.teacher_id,
      schedule_rule_id: null,
      date: makeup.date,
      time: makeup.time,
      duration: lesson.duration,
      class_type: "makeup" as ClassType,
      status: "scheduled" as LessonStatus,
      is_active: true,
      is_backfill: false,
      original_class_id: lessonId,
      original_payout_snapshot: null,
      is_substitute: false,
      original_teacher_id: null,
      payout_snapshot: lesson.payout_snapshot,
      note: makeup.note || ("補課(原課 " + lesson.date + ")"),
      superseded: false,
      created_at: now,
      updated_at: now,
    });
    if (mkErr) return { error: mkErr.message };

    // 讓原課程的自動延伸 inactive(如果已有)
    await supabase
      .from("lessons")
      .update({ is_active: false, updated_at: now })
      .eq("original_class_id", lessonId)
      .eq("class_type", "extension");
  }

  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true };
}

export async function cancelLessons(lessonIds: string[]) {
  if (!lessonIds.length) return { ok: true };
  const results = await Promise.all(lessonIds.map((id) => cancelLesson(id, null)));
  const err = results.find((r) => r.error);
  return err ? { error: err.error } : { ok: true };
}

// ── 代課 ──────────────────────────────────────────────────────────────────────
export async function substituteLesson(
  lessonId: string,
  newTeacherId: string,
  newSnapshot: PayoutSnapshot
) {
  const supabase = createClient();
  const now = new Date().toISOString();

  // 取得現有 lesson
  const { data: lesson, error: fetchErr } = await supabase
    .from("lessons")
    .select("teacher_id, payout_snapshot, is_substitute, original_teacher_id, original_payout_snapshot")
    .eq("id", lessonId)
    .single();
  if (fetchErr || !lesson) return { error: "找不到課程" };

  const originalTeacherId = lesson.is_substitute
    ? lesson.original_teacher_id
    : lesson.teacher_id;
  const originalSnapshot = lesson.is_substitute
    ? lesson.original_payout_snapshot
    : lesson.payout_snapshot;

  const { error } = await supabase
    .from("lessons")
    .update({
      teacher_id: newTeacherId,
      payout_snapshot: newSnapshot,
      original_payout_snapshot: originalSnapshot,
      is_substitute: true,
      original_teacher_id: originalTeacherId,
      updated_at: now,
    })
    .eq("id", lessonId);
  if (error) return { error: error.message };

  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true };
}

export async function substituteLessons(
  lessonIds: string[],
  newTeacherId: string,
  newSnapshot: PayoutSnapshot
) {
  if (!lessonIds.length) return { ok: true };
  const results = await Promise.all(
    lessonIds.map((id) => substituteLesson(id, newTeacherId, newSnapshot))
  );
  const err = results.find((r) => r.error);
  return err ? { error: err.error } : { ok: true };
}

// ── 撤銷代課 ──────────────────────────────────────────────────────────────────
export async function undoSubstitute(lessonId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: lesson, error: fetchErr } = await supabase
    .from("lessons")
    .select("original_payout_snapshot, original_teacher_id")
    .eq("id", lessonId)
    .single();
  if (fetchErr || !lesson) return { error: "找不到課程" };
  if (!lesson.original_payout_snapshot) return { error: "此課程沒有代課紀錄可撤銷" };

  const { error } = await supabase
    .from("lessons")
    .update({
      teacher_id: lesson.original_teacher_id,
      payout_snapshot: lesson.original_payout_snapshot,
      original_payout_snapshot: null,
      is_substitute: false,
      original_teacher_id: null,
      updated_at: now,
    })
    .eq("id", lessonId);
  if (error) return { error: error.message };

  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true };
}

// ── 更新課程備註 (#15) ────────────────────────────────────────────────────────
export async function updateLessonNote(lessonId: string, note: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ note: note.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  return { ok: true };
}

// ── 刪除待上課程(直接刪除,不產生延伸) ───────────────────────────────────────
export async function deleteLesson(lessonId: string) {
  const supabase = createClient();

  // 確認只能刪 scheduled 的課
  const { data: lesson } = await supabase
    .from("lessons")
    .select("status, account_id")
    .eq("id", lessonId)
    .single();

  if (!lesson) return { error: "找不到課程" };
  if (lesson.status !== "scheduled") return { error: "只能刪除待上的課程" };

  const { data: lessonToDelete } = await supabase
    .from("lessons")
    .select("account_id, student_id, date, time, duration, payout_snapshot")
    .eq("id", lessonId)
    .single();

  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId);

  if (error) return { error: error.message };

  // 刪除後自動補齊：依排課規則生成下一堂
  if (lessonToDelete?.account_id) {
    const { data: acc } = await supabase
      .from("accounts")
      .select("total_lessons, student_id")
      .eq("id", lessonToDelete.account_id)
      .single();

    if (acc) {
      // 算剩餘堂數
      const { count: completedCount } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("account_id", lessonToDelete.account_id)
        .eq("is_active", true)
        .eq("status", "completed");

      const { count: scheduledCount } = await supabase
        .from("lessons")
        .select("id", { count: "exact", head: true })
        .eq("account_id", lessonToDelete.account_id)
        .eq("is_active", true)
        .eq("status", "scheduled");

      const remaining = acc.total_lessons - (completedCount || 0) - (scheduledCount || 0);

      if (remaining > 0) {
        // 找排課規則
        const { data: rules } = await supabase
          .from("schedule_rules")
          .select("*")
          .eq("account_id", lessonToDelete.account_id)
          .eq("active_status", "Active");

        if (rules && rules.length > 0) {
          // 與 cancelLesson 同一套邏輯:從被刪除那堂之後找第一個
          // 符合規則且該學生無課的時段(跨帳戶檢查)。
          const slot = await findNextAvailableSlot(
            supabase,
            acc.student_id,
            rules as any,
            lessonToDelete.date
          );

          if (slot) {
            // 取出該時段對應的規則(週幾 + 時間都要吻合),
            // 以便帶入正確的老師與時長
            const slotWd = new Date(slot.date + "T00:00:00").getDay();
            const matchRule = rules.find(
              (r) =>
                (r.weekdays as number[]).includes(slotWd) && r.time === slot.time
            );

            if (matchRule) {
              const now2 = new Date().toISOString();
              await supabase.from("lessons").insert({
                id: uid("ls"),
                account_id: lessonToDelete.account_id,
                student_id: acc.student_id,
                teacher_id: matchRule.teacher_id || null,
                schedule_rule_id: matchRule.id,
                date: slot.date,
                time: slot.time,
                duration: matchRule.duration,
                class_type: "general",
                status: "scheduled",
                is_active: true,
                is_backfill: false,
                original_class_id: null,
                original_payout_snapshot: null,
                is_substitute: false,
                original_teacher_id: null,
                payout_snapshot: lessonToDelete.payout_snapshot,
                note: null,
                superseded: false,
                created_at: now2,
                updated_at: now2,
              });
            }
          }
        }
      }
    }
  }

  revalidatePath("/lessons");
  revalidatePath("/accounts");
  revalidatePath("/");
  return { ok: true };
}
