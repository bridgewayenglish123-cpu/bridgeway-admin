"use client";

import { useState, useTransition } from "react";
import { C } from "@/lib/constants";
import { money } from "@/lib/utils";
import { periodOf } from "@/lib/domain";
import { calcPeriodRows, TeacherPeriodRow } from "./RemitClient";
import { TeacherBreakdownTable } from "./PeriodCard";
import type { Teacher, Account, Lesson, RemittancePeriod, RemittanceExtra } from "@/lib/supabase/types";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { useConfirm } from "@/components/ConfirmProvider";
import { markPaid } from "@/app/actions/remit";

interface Props {
  allPeriodKeys: string[];
  lessons: Lesson[];
  teachers: Teacher[];
  accounts: Account[];
  accountById: Record<string, Account>;
  extras: RemittanceExtra[];
  periods: Record<string, RemittancePeriod>;
  phpRate: number;
  onAddExtra: (periodKey: string) => void;
  onToast: (msg: string, ok?: boolean) => void;
}

function downloadCsv(
  allPeriodKeys: string[],
  lessons: Lesson[],
  teachers: Teacher[],
  accountById: Record<string, Account>,
  extras: RemittanceExtra[],
  periods: Record<string, RemittancePeriod>,
  phpRate: number
) {
  const teacherById = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const rows: string[][] = [];
  const header = ["期間", "老師", "試聽堂", "25分堂", "55分堂", "總堂", "老師應得 NTD", "老師應得 PHP", "狀態", "已匯日期"];
  rows.push(header);

  for (const pk of [...allPeriodKeys].sort()) {
    const p = periodOf(pk);
    const { rows: tRows, lessonCount } = calcPeriodRows(pk, lessons, teachers, accountById);
    const period = periods[pk];
    const status = period?.paid ? "已匯" : "未匯";
    const paidDate = period?.paid_date || "";

    for (const r of tRows) {
      rows.push([
        p.label,
        r.teacherName,
        String(r.trial),
        String(r.s25),
        String(r.l55),
        String(r.total),
        String(r.payoutNtd + r.hanneNtd),
        String(Math.round((r.payoutNtd + r.hanneNtd) * phpRate)),
        status,
        paidDate,
      ]);
    }

    // 額外費用列
    const pkExtras = extras.filter((e) => e.period_key === pk);
    for (const e of pkExtras) {
      const tName = (teacherById[e.teacher_id || ""]?.teacher_name || "未指定") + "(額外)";
      rows.push([p.label, tName, "", "", "", "", String(e.amount_ntd), String(e.amount_php), status, paidDate]);
    }
  }

  const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bridgeway_remit_" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

function PeriodRow({
  periodKey, lessons, teachers, accountById, extras, period, phpRate, onAddExtra, onToast,
}: {
  periodKey: string;
  lessons: Lesson[];
  teachers: Teacher[];
  accountById: Record<string, Account>;
  extras: RemittanceExtra[];
  period: RemittancePeriod | null;
  phpRate: number;
  onAddExtra: () => void;
  onToast: (msg: string, ok?: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { askConfirm } = useConfirm();
  const [isPending, startTransition] = useTransition();

  const p = periodOf(periodKey);
  const { totalPayoutNtd, totalLeeNtd, lessonCount } = calcPeriodRows(
    periodKey, lessons, teachers, accountById
  );
  const extraNtd = extras.reduce((s, e) => s + e.amount_ntd, 0);
  const extraPhp = extras.reduce((s, e) => s + e.amount_php, 0);
  const totalNtd = totalPayoutNtd + extraNtd;
  const totalPhp = Math.round(totalNtd * phpRate);
  const isPaid = period?.paid || false;

  const handleToggle = () => {
    if (isPaid) {
      askConfirm({
        title: "撤銷已匯",
        message: "即將把「" + p.label + "」的匯款狀態撤銷為「未匯」。\n\n若已實際匯款給老師,這個動作不會退錢,只影響系統顯示。",
        confirmLabel: "確認撤銷",
        onConfirm: async () => {
          const res = await markPaid(periodKey, false);
          if (res.error) onToast(res.error, false);
          else onToast("已標記為未匯");
        },
      });
    } else {
      startTransition(async () => {
        const res = await markPaid(periodKey, true);
        if (res.error) onToast(res.error, false);
        else onToast("已標記為已匯");
      });
    }
  };

  return (
    <div style={{ borderBottom: `1px solid ${C.line}` }}>
      <div
        className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs" style={{ color: C.muted }}>{expanded ? "▼" : "▶"}</span>
          <span className="text-sm font-medium" style={{ color: C.navy }}>{p.label}</span>
          <span className="text-xs" style={{ color: C.muted }}>匯款 {p.remit}</span>
          <span className="text-xs" style={{ color: C.muted }}>{lessonCount} 堂</span>
          {extras.length > 0 && (
            <Badge tone="amber">+{extras.length} 額外</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <span className="text-sm font-semibold" style={{ color: C.gold }}>
            ₱ {money(totalPhp)}
          </span>
          <span className="text-xs" style={{ color: C.muted }}>(NT$ {money(totalNtd)})</span>
          <Badge tone={isPaid ? "green" : "amber"}>{isPaid ? "已匯" : "未匯"}</Badge>
          <Btn kind={isPaid ? "ghost" : "gold"} size="sm" disabled={isPending} onClick={handleToggle}>
            {isPending ? "…" : isPaid ? "標記未匯" : "標記已匯"}
          </Btn>
          <button
            className="text-xs px-2 py-1 rounded"
            style={{ background: "#EAF0F6", color: C.navy }}
            onClick={onAddExtra}
          >
            ＋ 額外
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <TeacherBreakdownTable
            periodKey={periodKey}
            lessons={lessons}
            teachers={teachers}
            accountById={accountById}
            phpRate={phpRate}
          />
          {extras.length > 0 && (
            <div className="text-xs space-y-1 pt-1" style={{ color: C.muted }}>
              <div className="font-semibold" style={{ color: C.amber }}>額外費用</div>
              {extras.map((e) => (
                <div key={e.id} className="flex gap-2">
                  <span>{e.date}</span>
                  <span>{e.note || "—"}</span>
                  <span style={{ color: C.gold }}>₱ {money(e.amount_php)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-sm text-right pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
            <span style={{ color: C.muted }}>Lee 淨收入 </span>
            <span className="font-semibold" style={{ color: C.green }}>NT$ {money(totalLeeNtd)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HistoryCard({
  allPeriodKeys, lessons, teachers, accounts, accountById,
  extras, periods, phpRate, onAddExtra, onToast,
}: Props) {
  const paidCount = allPeriodKeys.filter((k) => periods[k]?.paid).length;
  const unpaidCount = allPeriodKeys.length - paidCount;

  return (
    <Card
      title={`匯款歷史(${allPeriodKeys.length} 期 · 已匯 ${paidCount} · 未匯 ${unpaidCount})`}
      collapsible
      storageKey="remit_history"
      defaultCollapsed={true}
      pad={false}
      right={
        <Btn
          kind="ghost"
          size="sm"
          onClick={() => downloadCsv(allPeriodKeys, lessons, teachers, accountById, extras, periods, phpRate)}
        >
          CSV 匯出
        </Btn>
      }
    >
      {allPeriodKeys.length === 0 ? (
        <div className="text-sm py-6 text-center" style={{ color: C.muted }}>
          尚無歷史匯款紀錄。
        </div>
      ) : (
        <div>
          {allPeriodKeys.map((pk) => (
            <PeriodRow
              key={pk}
              periodKey={pk}
              lessons={lessons}
              teachers={teachers}
              accountById={accountById}
              extras={extras.filter((e) => e.period_key === pk)}
              period={periods[pk] || null}
              phpRate={phpRate}
              onAddExtra={() => onAddExtra(pk)}
              onToast={onToast}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
