"use client";

import { useMemo } from "react";
import { C } from "@/lib/constants";
import { money, todayYMD, fmt, parseYMD } from "@/lib/utils";
import { periodOf, effectiveHanneShare, effectiveLeeCommission } from "@/lib/domain";
import type { Lesson, Account, Teacher } from "@/lib/supabase/types";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import { Table, Td } from "@/components/ui/Table";

interface Props {
  lessons: Lesson[];
  accounts: Account[];
  teachers: Teacher[];
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map((row) =>
    row.map((c) => {
      const s = String(c ?? "");
      return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")
  );
  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardWidgets({ lessons, accounts, teachers }: Props) {
  const teacherById = useMemo(
    () => Object.fromEntries(teachers.map((t) => [t.id, t])),
    [teachers]
  );

  // ── 17a 試聽轉正率 ──────────────────────────────────────────────────────────
  const trialStats = useMemo(() => {
    const cutoff = fmt(new Date(Date.now() - 30 * 86400000));
    const recentTrials = accounts.filter(
      (a) => a.is_trial && a.start_lesson_date && a.start_lesson_date >= cutoff
    );
    const converted = recentTrials.filter((trial) =>
      accounts.some(
        (a) =>
          a.student_id === trial.student_id &&
          !a.is_trial &&
          a.start_lesson_date &&
          a.start_lesson_date >= (trial.start_lesson_date || "")
      )
    );
    return {
      total: recentTrials.length,
      converted: converted.length,
      rate: recentTrials.length > 0
        ? Math.round((converted.length / recentTrials.length) * 100)
        : 0,
    };
  }, [accounts]);

  // ── 17b 老師穩定度 ──────────────────────────────────────────────────────────
  const teacherStability = useMemo(() => {
    const cutoff = fmt(new Date(Date.now() - 30 * 86400000));
    const stats: Record<string, { total: number; cancelled: number; substituted: number }> = {};
    for (const l of lessons) {
      if (!l.is_active || l.date < cutoff || !l.teacher_id) continue;
      const tid = l.teacher_id;
      if (!stats[tid]) stats[tid] = { total: 0, cancelled: 0, substituted: 0 };
      stats[tid].total++;
      if (l.status === "cancelled") stats[tid].cancelled++;
      if (l.is_substitute) stats[tid].substituted++;
    }
    return Object.entries(stats)
      .map(([tid, s]) => ({
        tid,
        name: teacherById[tid]?.teacher_name || "—",
        total: s.total,
        cancelled: s.cancelled,
        substituted: s.substituted,
        cancelRate: s.total > 0 ? Math.round((s.cancelled / s.total) * 100) : 0,
        subRate: s.total > 0 ? Math.round((s.substituted / s.total) * 100) : 0,
      }))
      .filter((s) => s.total >= 3)
      .sort((a, b) => b.cancelRate - a.cancelRate);
  }, [lessons, teacherById]);

  const hasStabilityWarning = teacherStability.some(
    (s) => s.cancelRate >= 10 || s.subRate >= 10
  );

  // ── 17c 營收趨勢 ────────────────────────────────────────────────────────────
  const periodTrend = useMemo(() => {
    const buckets: {
      key: string; label: string;
      revenue: number; teacher: number; hanne: number; lee: number; count: number;
    }[] = [];
    let d = new Date();
    const seen = new Set<string>();

    for (let i = 0; i < 12; i++) {
      const p = periodOf(fmt(d));
      if (!seen.has(p.key)) {
        seen.add(p.key);
        buckets.push({ key: p.key, label: p.label, revenue: 0, teacher: 0, hanne: 0, lee: 0, count: 0 });
      }
      const start = parseYMD(p.key)!;
      start.setDate(start.getDate() - 1);
      d = start;
    }

    const mapByKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    for (const l of lessons) {
      if (!l.is_active || l.status !== "completed") continue;
      const p = periodOf(l.date);
      const b = mapByKey[p.key];
      if (!b) continue;
      const s = l.payout_snapshot || ({} as any);
      const perLesson = s.lesson_count
        ? Math.round((s.original_price_ntd || 0) / s.lesson_count)
        : 0;
      b.revenue += perLesson;
      b.teacher += s.teacher_payout_ntd || 0;
      b.hanne += effectiveHanneShare(l);
      b.lee += effectiveLeeCommission(l);
      b.count += 1;
    }
    return buckets;
  }, [lessons]);

  const totalLee = periodTrend.reduce((s, m) => s + m.lee, 0);

  const exportTrendCsv = () => {
    const rows = periodTrend.map((m) => [
      m.label, m.count, m.revenue, m.teacher + m.hanne, m.lee,
    ]);
    downloadCSV(
      "bridgeway-period-trend-" + todayYMD() + ".csv",
      ["期別", "完課堂數", "營收 NTD", "老師支出 NTD", "Lee 淨收入 NTD"],
      rows
    );
  };

  return (
    <div className="space-y-4">
      {/* 17a 試聽轉正率 */}
      {trialStats.total > 0 && (
        <Card title="試聽轉正率(過去 30 天)">
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className="text-xs" style={{ color: C.muted }}>試聽學生數</div>
              <div className="text-2xl font-bold" style={{ color: C.navy }}>{trialStats.total}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: C.muted }}>已轉正式</div>
              <div className="text-2xl font-bold" style={{ color: C.green }}>{trialStats.converted}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: C.muted }}>轉正率</div>
              <div className="text-2xl font-bold" style={{
                color: trialStats.rate >= 50 ? C.green : trialStats.rate >= 30 ? C.amber : C.red
              }}>
                {trialStats.rate}%
              </div>
            </div>
            <div className="text-xs ml-auto" style={{ color: C.muted, maxWidth: 240, lineHeight: 1.5 }}>
              試聽後 30 天內開新正式帳戶算「已轉正」。這是 solo operator 最需要盯的指標。
            </div>
          </div>
        </Card>
      )}

      {/* 17b 老師穩定度 */}
      {hasStabilityWarning && (
        <Card title="老師穩定度警示(過去 30 天)">
          <div className="space-y-1.5">
            {teacherStability
              .filter((s) => s.cancelRate >= 10 || s.subRate >= 10)
              .map((s) => (
                <div
                  key={s.tid}
                  className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-lg text-sm"
                  style={{ background: s.cancelRate >= 20 ? C.redSoft : C.amberSoft }}
                >
                  <span className="font-medium" style={{ color: C.navy }}>{s.name}</span>
                  <span className="text-xs" style={{ color: C.muted }}>{s.total} 堂</span>
                  {s.cancelRate >= 10 && (
                    <span className="text-xs" style={{ color: C.red }}>
                      取消 {s.cancelled} 堂 ({s.cancelRate}%)
                    </span>
                  )}
                  {s.subRate >= 10 && (
                    <span className="text-xs" style={{ color: C.amber }}>
                      被代課 {s.substituted} 堂 ({s.subRate}%)
                    </span>
                  )}
                </div>
              ))}
          </div>
          <div className="mt-2 text-xs" style={{ color: C.muted }}>
            過去 30 天取消率 ≥ 10% 或被代課率 ≥ 10% 的老師會顯示於此(僅計算至少 3 堂以上的老師)。
          </div>
        </Card>
      )}

      {/* 17c 營收趨勢 */}
      <Card
        title={`營收趨勢(最近 12 期 · 總 Lee 收入 NT$ ${money(totalLee)})`}
        collapsible
        storageKey="dashboard_revenue_trend"
        defaultCollapsed={true}
        right={
          <Btn size="sm" kind="ghost" onClick={exportTrendCsv}>⬇ 匯出 CSV</Btn>
        }
      >
        <Table head={["期別", "完課堂數", "營收", "老師支出", "Lee 淨收入"]}>
          {periodTrend.map((m) => (
            <tr key={m.key} style={{ borderBottom: `1px solid ${C.line}` }}>
              <Td>{m.label}</Td>
              <Td>{m.count}</Td>
              <Td>NT$ {money(m.revenue)}</Td>
              <Td>NT$ {money(m.teacher + m.hanne)}</Td>
              <Td><span style={{ color: C.green, fontWeight: 500 }}>NT$ {money(m.lee)}</span></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
