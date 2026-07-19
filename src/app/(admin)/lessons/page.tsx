import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Student, Teacher, Account, PriceRule } from "@/lib/supabase/types";
import LessonsClient, { type LessonWithReports } from "./LessonsClient";

async function loadData() {
  const supabase = createClient();
  const [lessonsRes, studentsRes, scheduleRulesRes, metaRes, teachersRes, accountsRes, rulesRes] = await Promise.all([
    adminSupabase.from("lessons").select("*, lesson_reports ( id )").order("date", { ascending: false }).order("time"),
    supabase.from("students").select("id,zh_name,en_name"),
    supabase.from("schedule_rules").select("id,account_id,active_status"),
    supabase.from("app_meta").select("php_rate").eq("id", 1).single(),
    supabase.from("teachers").select("id,teacher_name,teacher_type,active_status"),
    supabase.from("accounts").select("id,student_id,course_label,teacher_type,course_family,duration_type,billing_type,snapshot"),
    supabase.from("price_rules").select("*").eq("active_status", "Active"),
  ]);
  return {
    lessons: (lessonsRes.data || []) as LessonWithReports[],
    scheduleRules: (scheduleRulesRes.data || []),
    phpRate: (typeof metaRes.data?.php_rate === "number" && metaRes.data.php_rate > 0 ? metaRes.data.php_rate : 1.8),
    students: (studentsRes.data || []) as Pick<Student, "id" | "zh_name" | "en_name">[],
    teachers: (teachersRes.data || []) as Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">[],
    accounts: (accountsRes.data || []) as Pick<Account, "id" | "student_id" | "course_label" | "teacher_type" | "course_family" | "duration_type" | "billing_type" | "snapshot">[],
    priceRules: (rulesRes.data || []) as PriceRule[],
  };
}

export default async function LessonsPage() {
  const data = await loadData();
  return <LessonsClient {...data} />;
}
