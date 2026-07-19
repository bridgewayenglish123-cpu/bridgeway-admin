import { createAdminClient } from "@/lib/supabase/admin";
import ReportsClient from "./ReportsClient";

async function loadData() {
  const supabase = createAdminClient();
  const [reportsRes, studentsRes, lessonsRes, teachersRes] = await Promise.all([
    supabase
      .from("lesson_reports")
      .select("id,lesson_id,student_id,analysis_zh,analysis_en,vocabulary,next_focus,milestone,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("students").select("id,zh_name,en_name"),
    supabase.from("lessons").select("id,date,time,duration,teacher_id,account_id"),
    supabase.from("teachers").select("id,teacher_name"),
  ]);
  return {
    reports: reportsRes.data || [],
    students: studentsRes.data || [],
    lessons: lessonsRes.data || [],
    teachers: teachersRes.data || [],
  };
}

export default async function ReportsPage() {
  const data = await loadData();
  return <ReportsClient {...data} />;
}
