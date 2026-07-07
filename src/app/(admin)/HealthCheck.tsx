"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/constants";
import type { Lesson, Account, Student, Teacher, ScheduleRule } from "@/lib/supabase/types";

interface Props {
  lessons: Lesson[];
  accounts: Account[];
  students: Student[];
  teachers: Teacher[];
  scheduleRules: ScheduleRule[];
}

interface Issue {
  msg: string;
  details: string[];
  href: string;
  linkLabel: string;
}

export default function HealthCheck({ lessons, accounts, students, teachers, scheduleRules }: Props) {
  const router = useRouter();

  const issues = useMemo((): Issue[] => {
    const accountIds = new Set(accounts.map((a) => a.id));
    const studentIds = new Set(students.map((s) => s.id));
    const teacherIds = new Set(teachers.map((t) => t.id));
    const studentById = Object.fromEntries(students.map((s) => [s.id, s]));
    const accountById = Object.fromEntries(accounts.map((a) => [a.id, a]));

    const result: Issue[] = [];

    // 1. 孤兒 lessons
    const orphanLessons = lessons.filter((l) => l.is_active && !accountIds.has(l.account_id));
    if (orphanLessons.length > 0) {
      const names = [...new Set(orphanLessons.map((l) => {
        const st = studentById[l.student_id];
        return st ? st.zh_name : `student_id: ${l.student_id.slice(0, 8)}`;
      }))].slice(0, 5);
      result.push({
        msg: `${orphanLessons.length} 堂課的所屬帳戶已不存在`,
        details: names.map((n) => `→ ${n}`),
        href: "/lessons",
        linkLabel: "前往課程管理",
      });
    }

    // 2. 孤兒 schedule_rules
    const orphanRules = scheduleRules.filter((r) => !accountIds.has(r.account_id));
    if (orphanRules.length > 0) {
      result.push({
        msg: `${orphanRules.length} 條排課規則所屬帳戶已不存在`,
        details: orphanRules.slice(0, 5).map((r) => `→ account_id: ${r.account_id.slice(0, 8)}…`),
        href: "/schedule",
        linkLabel: "前往排課管理 → 一鍵清理",
      });
    }

    // 3. 孤兒 accounts
    const orphanAccounts = accounts.filter((a) => !studentIds.has(a.student_id));
    if (orphanAccounts.length > 0) {
      result.push({
        msg: `${orphanAccounts.length} 個帳戶的學生已被刪除`,
        details: orphanAccounts.slice(0, 5).map((a) => `→ ${a.course_label}`),
        href: "/accounts",
        linkLabel: "前往學員課程 → 一鍵清理",
      });
    }

    // 4. lesson teacher 無效
    const badTeacherLessons = lessons.filter(
      (l) => l.is_active && l.teacher_id && !teacherIds.has(l.teacher_id)
    );
    if (badTeacherLessons.length > 0) {
      const names = [...new Set(badTeacherLessons.map((l) => {
        const st = studentById[l.student_id];
        return st ? `${st.zh_name} (${l.date})` : l.date;
      }))].slice(0, 5);
      result.push({
        msg: `${badTeacherLessons.length} 堂課的老師已被刪除`,
        details: names.map((n) => `→ ${n}`),
        href: "/lessons",
        linkLabel: "前往課程管理",
      });
    }

    // 5. 已完課但排課還在生效
    const overActiveRules = scheduleRules.filter((r) => {
      if (r.active_status !== "Active") return false;
      const acc = accountById[r.account_id];
      if (!acc) return false;
      const completed = lessons.filter(
        (l) => l.account_id === acc.id && l.is_active && l.status === "completed"
      ).length;
      return acc.total_lessons - completed <= 0;
    });
    if (overActiveRules.length > 0) {
      const details = overActiveRules.slice(0, 5).map((r) => {
        const acc = accountById[r.account_id];
        const st = acc ? studentById[acc.student_id] : null;
        const wdLabels = (r.weekdays as number[]).sort()
          .map((d) => `週${["日","一","二","三","四","五","六"][d]}`).join("、");
        return `→ ${st?.zh_name || "?"} · ${acc?.course_label || "?"} · ${wdLabels} ${r.time}`;
      });
      result.push({
        msg: `${overActiveRules.length} 條排課規則的帳戶已完成所有堂數(應停用)`,
        details,
        href: "/schedule",
        linkLabel: "前往排課管理 → 停用規則",
      });
    }

    // 6. payout snapshot 缺欄位
    const badSnapshot = lessons.filter(
      (l) =>
        l.is_active &&
        l.status === "completed" &&
        (!l.payout_snapshot || l.payout_snapshot.teacher_payout_ntd === undefined)
    );
    if (badSnapshot.length > 0) {
      const names = badSnapshot.slice(0, 5).map((l) => {
        const st = studentById[l.student_id];
        return `→ ${st?.zh_name || "?"} (${l.date})`;
      });
      result.push({
        msg: `${badSnapshot.length} 堂完課缺 payout 資料(影響匯款計算)`,
        details: names,
        href: "/lessons",
        linkLabel: "前往課程管理",
      });
    }

    return result;
  }, [lessons, accounts, students, teachers, scheduleRules]);

  if (issues.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#FEE2E2", border: "1px solid #FCA5A5" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ background: "#FEE2E2", borderBottom: "1px solid #FCA5A5" }}
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
      <div className="px-4 py-3 space-y-3">
        {issues.map((issue, i) => (
          <div key={i}>
            <div className="text-sm font-medium" style={{ color: C.red }}>
              ⚠ {issue.msg}
            </div>
            <div className="mt-1 space-y-0.5 pl-3">
              {issue.details.map((d, j) => (
                <div key={j} className="text-xs" style={{ color: "#991B1B" }}>{d}</div>
              ))}
              {issue.details.length === 0 ? null : (
                <button
                  onClick={() => router.push(issue.href)}
                  className="text-xs mt-1 underline"
                  style={{ color: C.red }}
                >
                  {issue.linkLabel} →
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="text-xs pt-1 border-t" style={{ color: "#991B1B", borderColor: "#FCA5A5" }}>
          點上方連結前往對應頁面處理。
        </div>
      </div>
    </div>
  );
}
