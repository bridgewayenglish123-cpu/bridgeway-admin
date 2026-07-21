"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { StudentStatus } from "@/lib/supabase/types";

function uid() {
  return "st_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function createStudent(data: {
  zh_name: string;
  en_name: string;
  zoom_email: string;
  contact_info: string;
  age: string;
  current_teacher_id: string;
}) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("students").insert({
    id: uid(),
    zh_name: data.zh_name.trim(),
    en_name: data.en_name.trim() || null,
    zoom_email: data.zoom_email.trim() || null,
    contact_info: data.contact_info.trim() || null,
    age: data.age.trim() || null,
    status: "Active" as StudentStatus,
    current_teacher_id: data.current_teacher_id || null,
    created_at: now,
    updated_at: now,
  });
  if (error) return { error: error.message };
  revalidatePath("/students");
  return { ok: true };
}

export async function updateStudent(
  id: string,
  data: {
    zh_name: string;
    en_name: string;
    zoom_email: string;
    contact_info: string;
    age: string;
    current_teacher_id: string;
    level?: string;
    learner_type?: string;
  }
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("students")
    .update({
      zh_name: data.zh_name.trim(),
      en_name: data.en_name.trim() || null,
      zoom_email: data.zoom_email.trim() || null,
      contact_info: data.contact_info.trim() || null,
      age: data.age.trim() || null,
      current_teacher_id: data.current_teacher_id || null,
      level: data.level || 'Elementary',
      learner_type: data.learner_type || 'Adult',
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/students");
  return { ok: true };
}

export async function setStudentStatus(id: string, status: StudentStatus) {
  const supabase = createClient();
  const { error } = await supabase
    .from("students")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/students");
  return { ok: true };
}

export async function deleteStudent(id: string) {
  const supabase = createClient();
  // 只刪 student 本身,不 cascade
  // 孤兒 accounts/lessons 會被健康檢查抓到,由使用者決定清理
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/students");
  return { ok: true };
}

export async function importStudentsCSV(rows: {
  zh_name: string;
  en_name?: string;
  zoom_email?: string;
  contact_info?: string;
  age?: string;
}[]) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const inserts = rows.map((r) => ({
    id: uid(),
    zh_name: r.zh_name.trim(),
    en_name: r.en_name?.trim() || null,
    zoom_email: r.zoom_email?.trim() || null,
    contact_info: r.contact_info?.trim() || null,
    age: r.age?.trim() || null,
    status: "Active" as StudentStatus,
    current_teacher_id: null,
    created_at: now,
    updated_at: now,
  }));
  const { error } = await supabase.from("students").insert(inserts);
  if (error) return { error: error.message };
  revalidatePath("/students");
  return { ok: true, count: inserts.length };
}
