"use client";

import { useState, useTransition, useMemo } from "react";
import { C } from "@/lib/constants";
import { money, todayYMD } from "@/lib/utils";
import { periodOf, effectiveHanneShare, effectiveLeeCommission } from "@/lib/domain";
import type { Teacher, Account, Lesson, RemittancePeriod, RemittanceExtra } from "@/lib/supabase/types";
import PageIntro from "@/components/ui/PageIntro";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import PeriodCard from "./PeriodCard";
import HistoryCard from "./HistoryCard";
import TotalsCard from "./TotalsCard";
import ExtraModal from "./ExtraModal";
import { useConfirm } from "@/components/ConfirmProvider";
import { updatePhpRate } from "@/app/actions/remit";

interface Props {
  teachers: Teacher[];
  accounts: Account[];
  lessons: Lesson[];
  periods: RemittancePeriod[];
  extras: RemittanceExtra[];
  phpRate: number;
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
      style={{ background: ok ? C.green : C.red, color: "#fff", maxWidth: 340 }}
    >
      {msg}
    </div>
  );
}

// ── 分類輔助 ──────────────────────────────────────────────────────────────────
export function classifyLesson(
  lesson: Lesson,
  accountById: Record<string, Account>
): "trial" | "s25" | "l55" {
  const acc = accountById[lesson.account_id];
  const dur = lesson.duration || 25;
  const lc = lesson.payout_snapshot?.lesson_count || 1;
  const isTrial =
    acc?.billing_type === "Trial" ||
    acc?.is_trial === true ||
    (lc === 1 && dur === 25 && !acc);
  if (isTrial) return "trial";
  if (dur <= 25 || acc?.duration_type === "Short25") return "s25";
  return "l55";
}

// ── 期別內完課 lesson 計算 ────────────────────────────────────────────────────
export interface TeacherPeriodRow {
  teacherId: string;
  teacherName: string;
  trial: number;
  s25: number;
  l55: number;
  total: number;
  payoutNtd: number;
  hanneNtd: number;
  leeNtd: number;
}

export interface HanneCommissionRow {
  periodKey: string;
  totalCommissionNtd: number;
}

export function calcPeriodRows(
  periodKey: string,
  lessons: Lesson[],
  teachers: Teacher[],
  accountById: Record<string, Account>
): { rows: TeacherPeriodRow[]; totalPayoutNtd: number; totalLeeNtd: number; hanneCommissionNtd: number; lessonCount: number; studentCount: number } {
  const period = periodOf(periodKey);
  const periodLessons = lessons.filter(
    (l) =>
      l.is_active &&
      l.status === "completed" &&
      l.date >= period.start &&
      l.date <= period.end
  );

  const byTeacher: Record<string, TeacherPeriodRow> = {};
  for (const l of periodLessons) {
    const tid = l.teacher_id || "__none__";
    if (!byTeacher[tid]) {
      const t = teachers.find((t) => t.id === tid);
      byTeacher[tid] = {
        teacherId: tid,
        teacherName: t?.teacher_name || "未知老師",
        trial: 0, s25: 0, l55: 0, total: 0,
        payoutNtd: 0, hanneNtd: 0, leeNtd: 0,
      };
    }
    const row = byTeacher[tid];
    const cat = classifyLesson(l, accountById);
    if (cat === "trial") row.trial++;
    else if (cat === "s25") row.s25++;
    else row.l55++;
    row.total++;
    row.payoutNtd += l.payout_snapshot?.teacher_payout_ntd || 0;
    // hanneNtd 只計入 Hanne 老師自己的抽成(teacher_type=Hanne)
    // Other 老師課程的 hanne_share 單獨匯總，不計入該老師應得
    const snap = l.payout_snapshot || ({} as any);
    const isHanneTeacher = teachers.find((t) => t.id === l.teacher_id)?.teacher_type === "Hanne";
    if (isHanneTeacher) {
      row.hanneNtd += effectiveHanneShare(l);
    }
    row.leeNtd += effectiveLeeCommission(l);
  }

  const rows = Object.values(byTeacher).sort((a, b) =>
    a.teacherName.localeCompare(b.teacherName)
  );

  // Hanne 佣金 = Other 老師課程裡的 hanne_share(截止日前)
  let hanneCommissionNtd = 0;
  for (const l of periodLessons) {
    const isOtherTeacher = teachers.find((t) => t.id === l.teacher_id)?.teacher_type !== "Hanne";
    if (isOtherTeacher) {
      hanneCommissionNtd += effectiveHanneShare(l);
    }
  }

  const totalPayoutNtd = rows.reduce((s, r) => s + r.payoutNtd + r.hanneNtd, 0) + hanneCommissionNtd;
  const totalLeeNtd = rows.reduce((s, r) => s + r.leeNtd, 0);
  const studentCount = new Set(periodLessons.map((l) => l.student_id)).size;

  return { rows, totalPayoutNtd, totalLeeNtd, hanneCommissionNtd, lessonCount: periodLessons.length, studentCount };
}

// ── 取得所有有課程的期別 ──────────────────────────────────────────────────────
export function getAllPeriodKeys(lessons: Lesson[]): string[] {
  const keys = new Set<string>();
  for (const l of lessons) {
    if (l.is_active && l.status === "completed") {
      keys.add(periodOf(l.date).key);
    }
  }
  return [...keys].sort((a, b) => b.localeCompare(a)); // 最新在前
}

export default function RemitClient({ teachers, accounts, lessons, periods, extras, phpRate: initPhpRate }: Props) {
  const [phpRate, setPhpRate] = useState(initPhpRate);
  const [rateInput, setRateInput] = useState(String(initPhpRate));
  const [ratePending, startRateTransition] = useTransition();
  const { askConfirm } = useConfirm();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [extraModal, setExtraModal] = useState<{ periodKey: string } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const accountById = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );
  const periodById = useMemo(
    () => Object.fromEntries(periods.map((p) => [p.period_key, p])),
    [periods]
  );

  const today = todayYMD();
  const curPeriodKey = periodOf(today).key;
  const curPeriod = periodOf(today);

  // 所有有資料的期別(含當期)
  const allPeriodKeys = useMemo(() => {
    const keys = new Set(getAllPeriodKeys(lessons));
    keys.add(curPeriodKey);
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [lessons, curPeriodKey]);

  // 本期計算
  const cur = useMemo(
    () => calcPeriodRows(curPeriodKey, lessons, teachers, accountById),
    [curPeriodKey, lessons, teachers, accountById]
  );

  const curExtras = extras.filter((e) => e.period_key === curPeriodKey);
  const curExtraNtd = curExtras.reduce((s, e) => s + e.amount_ntd, 0);
  const curExtraPhp = curExtras.reduce((s, e) => s + e.amount_php, 0);
  const curTotalNtd = cur.totalPayoutNtd + curExtraNtd;
  const curTotalPhp = Math.round(curTotalNtd * phpRate);

  // 上期計算(對比)
  const prevPeriodKeys = allPeriodKeys.filter((k) => k !== curPeriodKey);
  const prevKey = prevPeriodKeys[0];
  const prev = useMemo(
    () => (prevKey ? calcPeriodRows(prevKey, lessons, teachers, accountById) : null),
    [prevKey, lessons, teachers, accountById]
  );
  const prevLeeNtd = prev?.totalLeeNtd || 0;
  const leeDiff =
    prevLeeNtd > 0
      ? Math.round(((cur.totalLeeNtd - prevLeeNtd) / prevLeeNtd) * 100)
      : null;

  const handleSaveRate = () => {
    const r = parseFloat(rateInput);
    if (!r || r <= 0) { showToast("匯率必須大於 0", false); return; }
    startRateTransition(async () => {
        const res = await updatePhpRate(r);
      if (res.error) showToast(res.error, false);
      else { setPhpRate(r); showToast(`匯率已更新為 ${r}`); }
    });
  };

  const statCard = (
    label: string,
    value: React.ReactNode,
    sub: React.ReactNode,
    color: string = C.navy
  ) => (
    <div
      className="rounded-xl p-4 md:p-5"
      style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowSoft }}
    >
      <div className="text-xs" style={{ color: C.muted }}>{label}</div>
      <div className="text-xl md:text-2xl font-bold mt-1.5" style={{ color, fontFamily: "'Noto Serif TC',serif" }}>
        {value}
      </div>
      <div className="text-xs mt-1" style={{ color: C.muted }}>{sub}</div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 頁首 */}
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>匯款總覽</h2>
      </div>

      <PageIntro storageKey="remit" title="匯款總覽 · 說明">
        <p>系統依完課紀錄自動計算每期 PH Team 應得薪資,你只需要確認金額、匯款、標記已匯。</p>
        <p>• <strong>期別規則</strong>:每月 10-24 完課 → 25 日匯款 / 25-次月 9 完課 → 次月 10 日匯款</p>
        <p>• <strong>額外費用</strong>:紅包/獎金/補助以 PHP 為主,併入當期合計一起匯</p>
        <p>• <strong>Hanne 抽成</strong>:2026-07-05 截止,之後課程的 Hanne 抽成自動歸入 Lee</p>
        <p>• 標記已匯後該期不計入未匯統計,可隨時切換回未匯</p>
      </PageIntro>

      {/* 4 張 stat 卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCard(
          "本期應匯 PH Team",
          `₱ ${money(curTotalPhp)}`,
          <>NT$ {money(curTotalNtd)} · 匯款 {curPeriod.remit}</>,
          C.gold
        )}
        {statCard(
          "本期完課數",
          `${cur.lessonCount} 堂`,
          `共 ${cur.studentCount} 位學生`
        )}
        {statCard(
          "本期 Lee 淨收入",
          `NT$ ${money(cur.totalLeeNtd)}`,
          leeDiff !== null ? (
            <span style={{ color: leeDiff >= 0 ? C.green : C.red }}>
              {leeDiff >= 0 ? "↑" : "↓"} vs 上期 {Math.abs(leeDiff)}%
            </span>
          ) : "首期無對比",
          C.green
        )}
        {/* PHP 匯率卡(可編輯) */}
        <div
          className="rounded-xl p-4 md:p-5"
          style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowSoft }}
        >
          <div className="text-xs" style={{ color: C.muted }}>PHP 匯率</div>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-20 rounded-lg border px-2 py-1 text-lg font-bold"
              style={{ borderColor: C.line, color: C.navy, fontFamily: "'Noto Serif TC',serif" }}
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
            <Btn kind="ghost" size="sm" disabled={ratePending} onClick={handleSaveRate}>
              {ratePending ? "…" : "儲存"}
            </Btn>
          </div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>1 NTD = {phpRate} PHP</div>
        </div>
      </div>

      {/* 本期匯款 Card */}
      <PeriodCard
        periodKey={curPeriodKey}
        lessons={lessons}
        teachers={teachers}
        accountById={accountById}
        extras={curExtras}
        period={periodById[curPeriodKey] || null}
        phpRate={phpRate}
        isCurrent={true}
        onAddExtra={() => setExtraModal({ periodKey: curPeriodKey })}
        onToast={showToast}
      />

      {/* 匯款歷史 */}
      <HistoryCard
        allPeriodKeys={allPeriodKeys.filter((k) => k !== curPeriodKey)}
        lessons={lessons}
        teachers={teachers}
        accounts={accounts}
        accountById={accountById}
        extras={extras}
        periods={periodById}
        phpRate={phpRate}
        onAddExtra={(key) => setExtraModal({ periodKey: key })}
        onToast={showToast}
      />

      {/* 累計統計 */}
      <TotalsCard
        teachers={teachers}
        lessons={lessons}
        accountById={accountById}
        phpRate={phpRate}
      />

      {/* 額外費用 Modal */}
      {extraModal && (
        <ExtraModal
          periodKey={extraModal.periodKey}
          teachers={teachers}
          phpRate={phpRate}
          onDone={(msg) => { showToast(msg); setExtraModal(null); }}
          onError={(msg) => showToast(msg, false)}
          onClose={() => setExtraModal(null)}
        />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
