import { createClient } from "@/lib/supabase/server";
import type { Teacher, Account, Student, ScheduleRule, Lesson } from "@/lib/supabase/types";
import ScheduleClient from "./ScheduleClient";

async function loadData() {
  const supabase = createClient();
  const [rulesRes, accountsRes, studentsRes, teachersRes, lessonsRes] = await Promise.all([
    supabase.from("schedule_rules").select("*").order("created_at", { ascending: false }),
    supabase.from("accounts").select("*"),
    supabase.from("students").select("id,zh_name,en_name,status"),
    supabase.from("teachers").select("id,teacher_name,teacher_type,active_status"),
    supabase.from("lessons").select("id,account_id,date,time,class_type,status,is_active"),
  ]);
  return {
    rules: (rulesRes.data || []) as ScheduleRule[],
    accounts: (accountsRes.data || []) as Account[],
    students: (studentsRes.data || []) as Pick<Student, "id" | "zh_name" | "en_name" | "status">[],
    teachers: (teachersRes.data || []) as Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">[],
    lessons: (lessonsRes.data || []) as Pick<Lesson, "id" | "account_id" | "date" | "time" | "class_type" | "status" | "is_active">[],
  };
}

export default async function SchedulePage() {
  const data = await loadData();
  return <ScheduleClient {...data} />;
}
