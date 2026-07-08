"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { addDays } from "@/lib/utils";
import type { LessonStatus, ClassType, PayoutSnapshot } from "@/lib/supabase/types";

function uid(prefix = "ls") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
  const { error } = await supabase
    .from("lessons")
    .update({ status: "scheduled", updated_at: new Date().toISOString() })
    .eq("id", lessonId);
  if (error) return { error: error.message };
  revalidatePath("/lessons");
  revalidatePath("/");
  return { ok: true };
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
    // 建自動延伸
    const { error: extErr } = await supabase.from("lessons").insert({
      id: uid("ls"),
      account_id: lesson.account_id,
      student_id: lesson.student_id,
      teacher_id: lesson.teacher_id,
      schedule_rule_id: null,
      date: addDays(lesson.date, 7),
      time: lesson.time,
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
