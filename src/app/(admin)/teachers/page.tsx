import { createClient } from "@/lib/supabase/server";
import type { Teacher, Lesson, ScheduleRule } from "@/lib/supabase/types";
import TeachersClient from "./TeachersClient";

async function loadData() {
  const supabase = createClient();
  const [teachersRes, lessonsRes, rulesRes] = await Promise.all([
    supabase.from("teachers").select("*").order("teacher_type").order("teacher_name"),
    supabase.from("lessons").select("id,teacher_id,status,is_active"),
    supabase.from("schedule_rules").select("id,teacher_id,active_status"),
  ]);
  return {
    teachers: (teachersRes.data || []) as Teacher[],
    lessons: (lessonsRes.data || []) as Pick<Lesson, "id" | "teacher_id" | "status" | "is_active">[],
    scheduleRules: (rulesRes.data || []) as Pick<ScheduleRule, "id" | "teacher_id" | "active_status">[],
  };
}

export default async function TeachersPage() {
  const { teachers, lessons, scheduleRules } = await loadData();

  const stats: Record<string, { total: number; completed: number; upcoming: number; activeRules: number }> =
    Object.fromEntries(
      teachers.map((t) => {
        const tLessons = lessons.filter((l) => l.teacher_id === t.id);
        return [
          t.id,
          {
            total: tLessons.length,
            completed: tLessons.filter((l) => l.is_active && l.status === "completed").length,
            upcoming: tLessons.filter((l) => l.is_active && l.status === "scheduled").length,
            activeRules: scheduleRules.filter(
              (r) => r.teacher_id === t.id && r.active_status === "Active"
            ).length,
          },
        ];
      })
    );

  return <TeachersClient teachers={teachers} stats={stats} />;
}
