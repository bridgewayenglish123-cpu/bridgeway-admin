import { createClient } from "@/lib/supabase/server";
import type { Student, Teacher, Account, Lesson } from "@/lib/supabase/types";
import StudentsClient from "./StudentsClient";

async function loadData() {
  const supabase = createClient();
  const [studentsRes, teachersRes, accountsRes, lessonsRes] = await Promise.all([
    supabase.from("students").select("*").order("zh_name"),
    supabase.from("teachers").select("id,teacher_name,teacher_type,active_status"),
    supabase.from("accounts").select("id,student_id,course_label,is_trial,total_lessons,status_override,billing_type"),
    supabase.from("lessons").select("id,student_id,account_id,status,is_active"),
  ]);
  return {
    students: (studentsRes.data || []) as Student[],
    teachers: (teachersRes.data || []) as Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">[],
    accounts: (accountsRes.data || []) as Pick<Account, "id" | "student_id" | "course_label" | "is_trial" | "total_lessons" | "status_override" | "billing_type">[],
    lessons: (lessonsRes.data || []) as Pick<Lesson, "id" | "student_id" | "account_id" | "status" | "is_active">[],
  };
}

export default async function StudentsPage() {
  const { students, teachers, accounts, lessons } = await loadData();
  return (
    <StudentsClient
      students={students}
      teachers={teachers}
      accounts={accounts}
      lessons={lessons}
    />
  );
}
