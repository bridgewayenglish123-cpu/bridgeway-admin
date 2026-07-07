"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/constants";
import { money, todayYMD } from "@/lib/utils";
import { periodOf } from "@/lib/domain";
import type { Lesson, Account, RemittancePeriod } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";

interface Props {
  lessons: Lesson[];
  accounts: Account[];
  remit: RemittancePeriod[];
  periodMap: Record<string, { lee: number; remitNtd: number }>;
  curPeriodKey: string;
  curPeriodLabel: string;
  curPeriodRemit: string;
}

type Tone = "gold" | "amber" | "red";

interface Step {
  label: string;
  actionLabel: string;
  href: string;
  tone: Tone;
}

const DOT_COLOR: Record<Tone, string> = {
  gold: C.gold,
  amber: C.amber,
  red: C.red,
};

export default function NextSteps({
  lessons, accounts, remit, periodMap, curPeriodKey, curPeriodLabel, curPeriodRemit,
}: Props) {
  const router = useRouter();
  const today = todayYMD();

  const steps = useMemo((): Step[] => {
    const result: Step[] = [];

    const accountStats = (acc: Account) => {
      const completed = lessons.filter(
        (l) => l.account_id === acc.id && l.is_active && l.status === "completed"
      ).length;
      return { completed, remaining: acc.total_lessons - completed };
    };

    // 1. 今日待標記
    const todayScheduled = lessons.filter(
      (l) => l.is_active && l.status === "scheduled" && l.date === today
    );
    if (todayScheduled.length > 0) {
      result.push({
        label: `今天有 ${todayScheduled.length} 堂課待標記完成 / 取消`,
        actionLabel: "前往",
        href: "/lessons",
        tone: "gold",
      });
    }

    // 2. 逾期未處理
    const overdue = lessons.filter(
      (l) => l.is_active && l.status === "scheduled" && l.date < today
    );
    if (overdue.length > 0) {
      result.push({
        label: `${overdue.length} 堂課已過期未處理 · 影響匯款結算`,
        actionLabel: "處理",
        href: "/lessons",
        tone: "red",
      });
    }

    // 3. 剩餘 ≤2 堂
    const lowStudents = accounts.filter((a) => {
      if (a.is_trial || a.status_override === "Closed") return false;
      const { remaining } = accountStats(a);
      return remaining > 0 && remaining <= 2;
    });
    if (lowStudents.length > 0) {
      result.push({
        label: `${lowStudents.length} 位學生課程剩 2 堂內 · 該提醒續購了`,
        actionLabel: "查看",
        href: "/accounts",
        tone: "amber",
      });
    }

    // 4. 試聽完未轉正(completed >= 1 且尚無正式帳戶)
    const trialToConvert = accounts.filter((a) => {
      if (!a.is_trial) return false;
      if (a.status_override === "Closed") return false;
      const { completed } = accountStats(a);
      if (completed < 1) return false;
      // 已有進行中的正式帳戶則不提醒
      return !accounts.some(
        (x) =>
          x.student_id === a.student_id &&
          !x.is_trial &&
          x.status_override !== "Closed"
      );
    });
    if (trialToConvert.length > 0) {
      result.push({
        label: `${trialToConvert.length} 位試聽完的學生尚未轉正式課`,
        actionLabel: "查看",
        href: "/accounts",
        tone: "amber",
      });
    }

    // 5. 未匯款期別
    const remitByKey = Object.fromEntries(remit.map((r) => [r.period_key, r]));
    const unpaidPeriods = Object.entries(periodMap)
      .filter(([key, val]) => !remitByKey[key]?.paid && val.remitNtd > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    if (unpaidPeriods.length > 0) {
      const totalNtd = unpaidPeriods.reduce((s, [, v]) => s + v.remitNtd, 0);
      const label =
        unpaidPeriods.length === 1 && unpaidPeriods[0][0] === curPeriodKey
          ? `本期 NT$ ${money(unpaidPeriods[0][1].remitNtd)} 待匯款 · 匯款日 ${curPeriodRemit}`
          : `${unpaidPeriods.length} 個期間待匯款,共 NT$ ${money(totalNtd)}`;
      result.push({
        label,
        actionLabel: "前往",
        href: "/remit",
        tone: "gold",
      });
    }

    return result.slice(0, 5);
  }, [lessons, accounts, remit, periodMap, curPeriodKey, curPeriodRemit, today]);

  if (steps.length === 0) return null;

  return (
    <div
      className="rounded-xl p-4 md:p-5 space-y-3"
      style={{
        background: "#FBF8EF",
        border: `1px solid rgba(194,153,47,0.22)`,
      }}
    >
      <div>
        <div
          className="text-sm font-semibold bw-display-en uppercase italic"
          style={{ color: C.gold, letterSpacing: "0.22em" }}
        >
          Next Steps
        </div>
        <div className="text-xs mt-0.5" style={{ color: C.muted }}>
          依當前狀態,這幾件事建議先做
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
            style={{ background: C.card, border: `1px solid ${C.line}` }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: DOT_COLOR[step.tone] }}
              />
              <span className="text-sm" style={{ color: C.text }}>{step.label}</span>
            </div>
            <Btn
              kind={step.tone === "red" ? "danger" : "ghost"}
              size="sm"
              onClick={() => router.push(step.href)}
            >
              {step.actionLabel}
            </Btn>
          </div>
        ))}
      </div>
    </div>
  );
}
