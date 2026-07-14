import { createClient } from "@/lib/supabase/server";
import type { Account, Student, Teacher, Lesson, PriceRule } from "@/lib/supabase/types";
import AccountsClient from "./AccountsClient";

async function loadData() {
  const supabase = createClient();
  const [accountsRes, studentsRes, teachersRes, lessonsRes, rulesRes] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: false }),
    supabase.from("students").select("id,zh_name,en_name,current_teacher_id,status"),
    supabase.from("teachers").select("id,teacher_name,teacher_type,active_status"),
    supabase.from("lessons").select("id,account_id,student_id,teacher_id,date,time,duration,status,is_active,class_type"),
    supabase.from("price_rules").select("*").order("teacher_type").order("display_name"),
  ]);
  return {
    accounts: (accountsRes.data || []) as Account[],
    students: (studentsRes.data || []) as Pick<Student, "id" | "zh_name" | "en_name" | "current_teacher_id" | "status">[],
    teachers: (teachersRes.data || []) as Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">[],
    lessons: (lessonsRes.data || []) as Pick<Lesson, "id" | "account_id" | "student_id" | "teacher_id" | "date" | "time" | "duration" | "status" | "is_active" | "class_type">[],
    priceRules: (rulesRes.data || []) as PriceRule[],
  };
}

export default async function AccountsPage() {
  const data = await loadData();
  return <AccountsClient {...data} />;
}
