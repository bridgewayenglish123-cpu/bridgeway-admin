"use client";

import { useMemo } from "react";
import { C } from "@/lib/constants";
import type { Lesson, Account, Student, Teacher, ScheduleRule } from "@/lib/supabase/types";
import Badge from "@/components/ui/Badge";

interface Props {
  lessons: Lesson[];
  accounts: Account[];
  students: Student[];
  teachers: Teacher[];
  scheduleRules: ScheduleRule[];
}

export default function HealthCheck({ lessons, accounts, students, teachers, scheduleRules }: Props) {
  const issues = useMemo(() => {
    const accountIds = new Set(accounts.map((a) => a.id));
    const studentIds = new Set(students.map((s) => s.id));
    const teacherIds = new Set(teachers.map((t) => t.id));

    const problems: string[] = [];

    // 1. 孤兒 lessons
    const orphanLessons = lessons.filter((l) => l.is_active && !accountIds.has(l.account_id));
    if (orphanLessons.length > 0)
      problems.push(`⚠ ${orphanLessons.length} 堂課的所屬帳戶已不存在`);

    // 2. 孤兒 schedule_rules
    const orphanRules = scheduleRules.filter((r) => !accountIds.has(r.account_id));
    if (orphanRules.length > 0)
      problems.push(`⚠ ${orphanRules.length} 條排課規則所屬帳戶已不存在`);

    // 3. 孤兒 accounts
    const orphanAccounts = accounts.filter((a) => !studentIds.has(a.student_id));
    if (orphanAccounts.length > 0)
      problems.push(`⚠ ${orphanAccounts.length} 個帳戶的學生已被刪除`);

    // 4. lesson teacher 無效
    const badTeacherLessons = lessons.filter(
      (l) => l.is_active && l.teacher_id && !teacherIds.has(l.teacher_id)
    );
    if (badTeacherLessons.length > 0)
      problems.push(`⚠ ${badTeacherLessons.length} 堂課的老師已被刪除`);

    // 5. 已完課但排課還在生效
    const overActiveRules = scheduleRules.filter((r) => {
      if (r.active_status !== "Active") return false;
      const acc = accounts.find((a) => a.id === r.account_id);
      if (!acc) return false;
      const completed = lessons.filter(
        (l) => l.account_id === acc.id && l.is_active && l.status === "completed"
      ).length;
      return acc.total_lessons - completed <= 0;
    });
    if (overActiveRules.length > 0)
      problems.push(`⚠ ${overActiveRules.length} 條排課規則的帳戶已完成所有堂數(應停用)`);

    // 6. payout snapshot 缺欄位
    const badSnapshot = lessons.filter(
      (l) =>
        l.is_active &&
        l.status === "completed" &&
        (!l.payout_snapshot || l.payout_snapshot.teacher_payout_ntd === undefined)
    );
    if (badSnapshot.length > 0)
      problems.push(`⚠ ${badSnapshot.length} 堂完課缺 payout 資料(影響匯款計算)`);

    return problems;
  }, [lessons, accounts, students, teachers, scheduleRules]);

  if (issues.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#FEE2E2", border: `1px solid #FCA5A5` }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: "#FEE2E2", borderBottom: `1px solid #FCA5A5` }}
      >
        <span className="text-sm font-semibold" style={{ color: C.red }}>
          資料健康檢查
        </span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: C.red, color: "#fff" }}
        >
          {issues.length} 項問題
        </span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {issues.map((msg, i) => (
          <div key={i} className="text-sm" style={{ color: C.red }}>
            {msg}
          </div>
        ))}
        <div className="text-xs pt-1" style={{ color: "#991B1B" }}>
          這些是資料關聯異常的紀錄,建議修正以確保計算正確。到相關頁面手動處理,或聯繫技術支援。
        </div>
      </div>
    </div>
  );
}
