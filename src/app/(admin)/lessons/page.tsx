import { createClient } from "@/lib/supabase/server";
import type { Lesson, Student, Teacher, Account, PriceRule } from "@/lib/supabase/types";
import LessonsClient from "./LessonsClient";

async function loadData() {
  const supabase = createClient();
  const [lessonsRes, studentsRes, teachersRes, accountsRes, rulesRes] = await Promise.all([
    supabase.from("lessons").select("*").order("date", { ascending: false }).order("time"),
    supabase.from("students").select("id,zh_name,en_name"),
    supabase.from("teachers").select("id,teacher_name,teacher_type,active_status"),
    supabase.from("accounts").select("id,student_id,course_label,teacher_type,course_family,duration_type,billing_type,snapshot"),
    supabase.from("price_rules").select("*").eq("active_status", "Active"),
  ]);
  return {
    lessons: (lessonsRes.data || []) as Lesson[],
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
