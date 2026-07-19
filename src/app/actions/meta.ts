"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setEmailNotifications(enabled: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("app_meta")
    .update({ email_notifications_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { ok: true };
}
