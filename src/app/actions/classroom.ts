"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createClassroomAccount(data: {
  studentId: string;
  email: string;
  password: string;
  zhName: string;
}) {
  const supabase = createAdminClient();

  // 1. 建立 Supabase Auth 帳號
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { zh_name: data.zhName },
  });

  if (authErr) return { error: authErr.message };
  if (!authData.user) return { error: "建立帳號失敗" };

  // 2. 把 auth_user_id 存回 students 表
  const { error: updateErr } = await supabase
    .from("students")
    .update({
      auth_user_id: authData.user.id,
      zoom_email: data.email,
      updated_at: new Date().toISOString().slice(0, 10),
    })
    .eq("id", data.studentId);

  if (updateErr) return { error: updateErr.message };

  revalidatePath("/students");
  return { ok: true, userId: authData.user.id };
}

export async function resetClassroomPassword(data: {
  authUserId: string;
  newPassword: string;
}) {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.updateUserById(data.authUserId, {
    password: data.newPassword,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteClassroomAccount(data: {
  studentId: string;
  authUserId: string;
}) {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.admin.deleteUser(data.authUserId);
  if (error) return { error: error.message };

  await supabase
    .from("students")
    .update({ auth_user_id: null, updated_at: new Date().toISOString().slice(0, 10) })
    .eq("id", data.studentId);

  revalidatePath("/students");
  return { ok: true };
}
