import { createClient } from "@/lib/supabase/server";
import type { Student, Teacher, Account, Lesson, Enrollment } from "@/lib/supabase/types";
import StudentsClient from "./StudentsClient";

async function loadData() {
  const supabase = createClient();
  const [studentsRes, teachersRes, accountsRes, lessonsRes, enrollmentsRes] = await Promise.all([
    supabase.from("students").select("*").order("zh_name"),
    supabase.from("teachers").select("id,teacher_name,teacher_type,active_status"),
    supabase.from("accounts").select("id,student_id,course_label,is_trial,total_lessons,status_override,billing_type,start_lesson_date"),
    supabase.from("lessons").select("id,student_id,account_id,teacher_id,original_teacher_id,date,time,class_type,status,is_active,is_substitute,note"),
    supabase.from("enrollments").select("id,student_id,snapshot"),
  ]);
  return {
    students: (studentsRes.data || []) as Student[],
    teachers: (teachersRes.data || []) as Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">[],
    accounts: (accountsRes.data || []) as Pick<Account, "id" | "student_id" | "course_label" | "is_trial" | "total_lessons" | "status_override" | "billing_type" | "start_lesson_date">[],
    lessons: (lessonsRes.data || []) as Pick<Lesson, "id" | "student_id" | "account_id" | "teacher_id" | "original_teacher_id" | "date" | "time" | "class_type" | "status" | "is_active" | "is_substitute" | "note">[],
    enrollments: (enrollmentsRes.data || []) as Pick<Enrollment, "id" | "student_id" | "snapshot">[],
  };
}

export default async function StudentsPage() {
  const { students, teachers, accounts, lessons, enrollments } = await loadData();
  return (
    <StudentsClient
      students={students}
      teachers={teachers}
      accounts={accounts}
      lessons={lessons}
      enrollments={enrollments}
    />
  );
}
