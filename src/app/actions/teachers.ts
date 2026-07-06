"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActiveStatus, TeacherType } from "@/lib/supabase/types";

function uid() {
  return "tc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function createTeacher(data: {
  teacher_name: string;
  teacher_code: string;
  teacher_type: TeacherType;
  email: string;
  notes: string;
}) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("teachers").insert({
    id: uid(),
    teacher_name: data.teacher_name.trim(),
    teacher_code: data.teacher_code.trim().toUpperCase(),
    teacher_type: data.teacher_type,
    active_status: "Active" as ActiveStatus,
    email: data.email.trim() || null,
    notes: data.notes.trim() || null,
    created_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  return { ok: true };
}

export async function updateTeacher(
  id: string,
  data: {
    teacher_name: string;
    teacher_code: string;
    teacher_type: TeacherType;
    email: string;
    notes: string;
  }
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("teachers")
    .update({
      teacher_name: data.teacher_name.trim(),
      teacher_code: data.teacher_code.trim().toUpperCase(),
      teacher_type: data.teacher_type,
      email: data.email.trim() || null,
      notes: data.notes.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  return { ok: true };
}

export async function setTeacherStatus(id: string, status: ActiveStatus) {
  const supabase = createClient();
  const { error } = await supabase
    .from("teachers")
    .update({ active_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  return { ok: true };
}

export async function deleteTeacher(id: string) {
  const supabase = createClient();
  const { data: lessons } = await supabase
    .from("lessons").select("id").eq("teacher_id", id).limit(1);
  if (lessons && lessons.length > 0)
    return { error: "此老師已有課程紀錄,無法刪除。請改為「停用」。" };
  const { data: rules } = await supabase
    .from("schedule_rules").select("id").eq("teacher_id", id).limit(1);
  if (rules && rules.length > 0)
    return { error: "此老師有排課規則,請先移除排課後再刪除,或改為停用。" };
  const { error } = await supabase.from("teachers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/teachers");
  return { ok: true };
}
