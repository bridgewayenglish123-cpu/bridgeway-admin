import { createClient } from "@/lib/supabase/server";
import { C } from "@/lib/constants";
import { ReportsClient } from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createClient();

  const [lessonsRes, teachersRes, studentsRes, reportsRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, date, time, duration, status, teacher_id, student_id, is_active")
      .eq("is_active", true)
      .eq("status", "completed")
      .order("date", { ascending: false })
      .order("time", { ascending: false })
      .limit(500),
    supabase.from("teachers").select("id, teacher_name, active_status"),
    supabase.from("students").select("id, zh_name, en_name"),
    supabase.from("lesson_reports").select("lesson_id, created_at"),
  ]);

  const lessons = lessonsRes.data ?? [];
  const teachers = teachersRes.data ?? [];
  const students = studentsRes.data ?? [];
  const reportMap = new Map(
    (reportsRes.data ?? []).map((r: any) => [r.lesson_id, r.created_at])
  );

  const teacherMap = new Map(teachers.map((t: any) => [t.id, t.teacher_name]));
  const studentMap = new Map(students.map((s: any) => [s.id, s.en_name || s.zh_name]));

  const rows = lessons.map((l: any) => ({
    id: l.id,
    date: l.date,
    time: l.time,
    duration: l.duration,
    teacherId: l.teacher_id,
    teacherName: teacherMap.get(l.teacher_id) ?? '—',
    studentName: studentMap.get(l.student_id) ?? '—',
    hasReport: reportMap.has(l.id),
    reportedAt: reportMap.get(l.id) ?? null,
  }));

  const activeTeachers = teachers
    .filter((t: any) => t.active_status === 'Active')
    .map((t: any) => ({ id: t.id, name: t.teacher_name }));

  return <ReportsClient rows={rows} teachers={activeTeachers} />;
}
