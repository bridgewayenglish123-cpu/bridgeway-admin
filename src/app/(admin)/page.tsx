import { createClient } from "@/lib/supabase/server";
import { C } from "@/lib/constants";
import { money, todayYMD, weekRange } from "@/lib/utils";
import { periodOf, effectiveHanneShare, effectiveLeeCommission } from "@/lib/domain";
import Card from "@/components/ui/Card";
import Empty from "@/components/ui/Empty";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import type { Lesson, Student, Teacher, Account, RemittancePeriod, ScheduleRule } from "@/lib/supabase/types";
import HealthCheck from "./HealthCheck";
import NextSteps from "./NextSteps";
import DashboardActions from "./DashboardActions";
import DashboardWidgets from "./DashboardWidgets";

async function loadData() {
  const supabase = createClient();
  const [teachersRes, studentsRes, accountsRes, lessonsRes, remitRes, metaRes, rulesRes] =
    await Promise.all([
      supabase.from("teachers").select("*"),
      supabase.from("students").select("*"),
      supabase.from("accounts").select("*"),
      supabase.from("lessons").select("*"),
      supabase.from("remittance_periods").select("*"),
      supabase.from("app_meta").select("*").eq("id", 1).single(),
      supabase.from("schedule_rules").select("*"),
    ]);
  return {
    teachers: (teachersRes.data || []) as Teacher[],
    students: (studentsRes.data || []) as Student[],
    accounts: (accountsRes.data || []) as Account[],
    lessons: (lessonsRes.data || []) as Lesson[],
    remit: (remitRes.data || []) as RemittancePeriod[],
    phpRate: metaRes.data?.php_rate || 1.8,
    scheduleRules: (rulesRes.data || []) as ScheduleRule[],
  };
}

export default async function DashboardPage() {
  const { teachers, students, accounts, lessons, remit, phpRate, scheduleRules } = await loadData();

  const today = todayYMD();
  const wk = weekRange();
  const curPeriod = periodOf(today);

  // ── 基本統計 ────────────────────────────────────────────────────────────────
  const todayLessons = lessons.filter(
    (l) => l.is_active && l.status === "scheduled" && l.date === today
  );
  const weekLessons = lessons.filter(
    (l) => l.is_active && l.status === "scheduled" && l.date >= wk.start && l.date <= wk.end
  );
  const overdueLessons = lessons.filter(
    (l) => l.is_active && l.status === "scheduled" && l.date < today
  );

  // 正在陪伴的學生
  const activeStudentIds = new Set<string>();
  for (const a of accounts) {
    if (a.status_override === "Closed" || a.is_trial) continue;
    const completed = lessons.filter(
      (l) => l.account_id === a.id && l.is_active && l.status === "completed"
    ).length;
    if (a.total_lessons - completed > 0) activeStudentIds.add(a.student_id);
  }

  // ── 期別收入 ─────────────────────────────────────────────────────────────────
  // 找出所有有完課的期別
  const periodMap: Record<string, { lee: number; remitNtd: number }> = {};
  for (const l of lessons) {
    if (!l.is_active || l.status !== "completed") continue;
    const pk = periodOf(l.date).key;
    if (!periodMap[pk]) periodMap[pk] = { lee: 0, remitNtd: 0 };
    periodMap[pk].lee += effectiveLeeCommission(l);
    periodMap[pk].remitNtd +=
      (l.payout_snapshot?.teacher_payout_ntd || 0) + effectiveHanneShare(l);
  }

  const curLeeNtd = periodMap[curPeriod.key]?.lee || 0;
  const curRemitNtd = periodMap[curPeriod.key]?.remitNtd || 0;

  // 上期 Lee 收入(用於對比)
  const sortedPeriodKeys = Object.keys(periodMap).sort((a, b) => b.localeCompare(a));
  const curPeriodIdx = sortedPeriodKeys.indexOf(curPeriod.key);
  const prevPeriodKey = sortedPeriodKeys[curPeriodIdx + 1];
  const prevLeeNtd = prevPeriodKey ? (periodMap[prevPeriodKey]?.lee || 0) : null;
  const leeDelta =
    prevLeeNtd !== null && prevLeeNtd > 0
      ? Math.round(((curLeeNtd - prevLeeNtd) / prevLeeNtd) * 100)
      : null;

  const curPHP = Math.round(curRemitNtd * phpRate);

  // ── 今日課程明細 ─────────────────────────────────────────────────────────────
  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));
  const teacherById = Object.fromEntries(teachers.map((t) => [t.id, t]));

  const todayFull = lessons
    .filter((l) => l.is_active && l.date === today)
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  // ── stat 卡 helper ───────────────────────────────────────────────────────────
  const stat = (
    label: string,
    value: string,
    sub: React.ReactNode,
    color: string = C.navy
  ) => (
    <div
      className="rounded-xl p-4 md:p-5"
      style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowSoft }}
    >
      <div className="text-xs" style={{ color: C.muted }}>{label}</div>
      <div
        className="text-xl md:text-2xl font-bold mt-1.5"
        style={{ color, fontFamily: "'Noto Serif TC',serif" }}
      >
        {value}
      </div>
      <div className="text-xs mt-1" style={{ color: C.muted }}>{sub}</div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 頁首 */}
      <div
        className="pb-4 md:flex md:items-end md:justify-between md:flex-wrap md:gap-4"
        style={{ borderBottom: `1px solid ${C.line}` }}
      >
        <div className="mb-3 md:mb-0">
          <div
            className="text-xs uppercase mb-1.5 bw-display-en"
            style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}
          >
            Bridgeway English · Admin
          </div>
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>
            儀表板
          </h2>
        </div>
        <div className="md:text-right">
          <div className="text-sm" style={{ color: C.text, letterSpacing: "0.05em" }}>{today}</div>
          {activeStudentIds.size > 0 && (
            <div className="text-xs mt-1" style={{ color: C.muted, letterSpacing: "0.03em" }}>
              Bridgeway 正在陪伴{" "}
              <span style={{ color: C.gold, fontWeight: 500 }}>{activeStudentIds.size}</span>{" "}
              位學生的英文旅程
            </div>
          )}
        </div>
      </div>

      {/* 逾期 banner */}
      {overdueLessons.length > 0 && (
        <div
          className="rounded-xl p-4"
          style={{ background: C.redSoft, border: `1px solid ${C.red}` }}
        >
          <div className="text-sm font-semibold" style={{ color: C.red }}>
            ⚠ 有 {overdueLessons.length} 堂已過期課程尚未標記
          </div>
          <div className="text-xs mt-0.5" style={{ color: C.red }}>
            未標記的課不會計入匯款結算與 Lee 收入。建議先去處理。
          </div>
        </div>
      )}

      {/* 資料健康檢查 */}
      <HealthCheck
        lessons={lessons}
        accounts={accounts}
        students={students}
        teachers={teachers}
        scheduleRules={scheduleRules}
      />

      {/* Next Steps */}
      <NextSteps
        lessons={lessons}
        accounts={accounts}
        remit={remit}
        periodMap={periodMap}
        curPeriodKey={curPeriod.key}
        curPeriodLabel={curPeriod.label}
        curPeriodRemit={curPeriod.remit}
      />

      {/* 4 張 stat 卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stat("今日課程", `${todayLessons.length} 堂`, "需確認完成 / 取消")}
        {stat("本週課程", `${weekLessons.length} 堂`, `${wk.start} ~ ${wk.end}`)}
        {stat(
          "本期 Lee 收入",
          `NT$ ${money(curLeeNtd)}`,
          leeDelta !== null ? (
            <span style={{ color: leeDelta >= 0 ? C.green : C.red }}>
              {leeDelta >= 0 ? "↑" : "↓"} {Math.abs(leeDelta)}% 對比上期
            </span>
          ) : (
            curLeeNtd === 0 ? "本期尚無完課" : `${curPeriod.label}`
          ),
          C.green
        )}
        {stat(
          "本期應匯 PH Team",
          `₱ ${money(curPHP)}`,
          curRemitNtd === 0
            ? "目前無待匯款"
            : `NT$ ${money(curRemitNtd)} · 匯款 ${curPeriod.remit}`,
          C.gold
        )}
      </div>

      {/* 今日課程 */}
      <DashboardActions
        todayFull={todayFull}
        studentById={studentById}
        teacherById={teacherById}
        today={today}
      />

      <DashboardWidgets
        lessons={lessons}
        accounts={accounts}
        teachers={teachers}
      />
    </div>
  );
}
