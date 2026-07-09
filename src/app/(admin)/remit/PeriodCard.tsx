"use client";

import { useTransition } from "react";
import { C } from "@/lib/constants";
import { money } from "@/lib/utils";
import { periodOf } from "@/lib/domain";
import { calcPeriodRows } from "./RemitClient";
import type { Teacher, Account, Lesson, RemittancePeriod, RemittanceExtra } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import { useConfirm } from "@/components/ConfirmProvider";
import { markPaid, deleteExtra } from "@/app/actions/remit";

interface Props {
  periodKey: string;
  lessons: Lesson[];
  teachers: Teacher[];
  accountById: Record<string, Account>;
  extras: RemittanceExtra[];
  period: RemittancePeriod | null;
  phpRate: number;
  isCurrent: boolean;
  onAddExtra: () => void;
  onToast: (msg: string, ok?: boolean) => void;
}

export function TeacherBreakdownTable({
  periodKey, lessons, teachers, accountById, phpRate,
}: {
  periodKey: string;
  lessons: Lesson[];
  teachers: Teacher[];
  accountById: Record<string, Account>;
  phpRate: number;
}) {
  const { rows, totalPayoutNtd, hanneCommissionNtd, lessonCount } = calcPeriodRows(periodKey, lessons, teachers, accountById);
  const totalPhp = Math.round(totalPayoutNtd * phpRate);

  if (rows.length === 0) {
    return (
      <div className="text-sm py-4 text-center" style={{ color: C.muted }}>
        本期尚無完課紀錄。
      </div>
    );
  }

  return (
    <Table head={["老師", "試聽 25分", "短課 25分", "完整 55分", "總堂", "老師應得 NTD", "≈ PHP"]}>
      {rows.map((r) => (
        <tr key={r.teacherId} style={{ borderBottom: `1px solid ${C.line}` }}>
          <Td><span className="font-medium" style={{ color: C.navy }}>{r.teacherName}</span></Td>
          <Td><span style={{ color: r.trial > 0 ? C.text : C.muted }}>{r.trial > 0 ? r.trial : "—"}</span></Td>
          <Td><span style={{ color: r.s25 > 0 ? C.text : C.muted }}>{r.s25 > 0 ? r.s25 : "—"}</span></Td>
          <Td><span style={{ color: r.l55 > 0 ? C.text : C.muted }}>{r.l55 > 0 ? r.l55 : "—"}</span></Td>
          <Td><span className="font-medium">{r.total}</span></Td>
          <Td><span style={{ color: C.navy }}>NT$ {money(r.payoutNtd + r.hanneNtd)}</span></Td>
          <Td><span style={{ color: C.gold }}>₱ {money(Math.round((r.payoutNtd + r.hanneNtd) * phpRate))}</span></Td>
        </tr>
      ))}
      {hanneCommissionNtd > 0 && (
        <tr style={{ borderBottom: `1px solid ${C.line}` }}>
          <Td><span className="text-xs" style={{ color: C.amber }}>Hanne 佣金(來自其他老師課程)</span></Td>
          <Td></Td><Td></Td><Td></Td>
          <Td></Td>
          <Td><span style={{ color: C.amber }}>NT$ {money(hanneCommissionNtd)}</span></Td>
          <Td><span style={{ color: C.amber }}>₱ {money(Math.round(hanneCommissionNtd * phpRate))}</span></Td>
        </tr>
      )}
      <tr style={{ background: "#EAF0F6" }}>
        <Td><span className="font-semibold" style={{ color: C.navy }}>基本小計</span></Td>
        <Td></Td><Td></Td><Td></Td>
        <Td><span className="font-semibold">{lessonCount}</span></Td>
        <Td><span className="font-semibold" style={{ color: C.navy }}>NT$ {money(totalPayoutNtd)}</span></Td>
        <Td><span className="font-semibold" style={{ color: C.gold }}>₱ {money(totalPhp)}</span></Td>
      </tr>
    </Table>
  );
}

export default function PeriodCard({
  periodKey, lessons, teachers, accountById, extras, period,
  phpRate, isCurrent, onAddExtra, onToast,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const { askConfirm } = useConfirm();

  const p = periodOf(periodKey);
  const { totalPayoutNtd, totalLeeNtd, hanneCommissionNtd: _hc, lessonCount } = calcPeriodRows(
    periodKey, lessons, teachers, accountById
  );

  const extraNtd = extras.reduce((s, e) => s + e.amount_ntd, 0);
  const extraPhp = extras.reduce((s, e) => s + e.amount_php, 0);
  const totalNtd = totalPayoutNtd + extraNtd;
  const totalPhp = Math.round(totalNtd * phpRate);
  const basePhp = Math.round(totalPayoutNtd * phpRate);
  const isPaid = period?.paid || false;
  const teacherById = Object.fromEntries(teachers.map((t) => [t.id, t]));

  // #27 撤銷已匯 confirm / 標記已匯直接執行
  const handleTogglePaid = () => {
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

  // #29 刪除額外費用 confirm
  const handleDeleteExtra = (e: RemittanceExtra) => {
    const tName = teacherById[e.teacher_id || ""]?.teacher_name || "整組共同";
    askConfirm({
      title: "刪除額外費用",
      message: "即將刪除這筆額外費用:\n\n老師:" + tName + "\n金額:PHP " + e.amount_php + " / NTD " + e.amount_ntd + "\n說明:" + (e.note || "—") + "\n\n刪除後匯款總額會即時調整。",
      confirmLabel: "確認刪除",
      danger: true,
      onConfirm: async () => {
        const res = await deleteExtra(e.id);
        if (res.error) onToast(res.error, false);
        else onToast("已刪除額外費用");
      },
    });
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}
    >
      {/* Card Header */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
        style={{ borderBottom: `1px solid ${C.line}` }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: C.navy }}>
            {isCurrent ? "本期匯款" : ""}（{p.label}）
          </h3>
          <div className="text-xs mt-0.5">
            建議匯款日{" "}
            <span className="font-semibold" style={{ color: isPaid ? C.muted : C.gold }}>{p.remit}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs" style={{ color: C.muted }}>{lessonCount} 堂完課</span>
          <button
            className="text-xs px-2 py-1 rounded"
            style={{ background: "#EAF0F6", color: C.navy }}
            onClick={onAddExtra}
          >
            ＋ 記錄額外費用
          </button>
          <Badge tone={isPaid ? "green" : "amber"}>{isPaid ? "已匯" : "未匯"}</Badge>
          <Btn kind={isPaid ? "ghost" : "gold"} size="sm" disabled={isPending} onClick={handleTogglePaid}>
            {isPending ? "…" : isPaid ? "標記未匯" : "標記已匯"}
          </Btn>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 金額摘要 */}
        <div className="flex items-center flex-wrap gap-4">
          {extras.length === 0 ? (
            <div className="text-sm" style={{ color: C.text }}>
              基本應匯{" "}
              <span className="font-bold" style={{ color: C.gold }}>₱ {money(basePhp)}</span>
              <span className="ml-1 text-xs" style={{ color: C.muted }}>(NT$ {money(totalPayoutNtd)})</span>
            </div>
          ) : (
            <div className="text-sm flex flex-wrap items-center gap-2" style={{ color: C.text }}>
              <span>
                基本 <span style={{ color: C.gold }}>₱ {money(basePhp)}</span>
                <span className="text-xs ml-1" style={{ color: C.muted }}>(NT$ {money(totalPayoutNtd)})</span>
              </span>
              <span style={{ color: C.muted }}>＋</span>
              <span>
                額外 <span style={{ color: C.gold }}>₱ {money(extraPhp)}</span>
                <span className="text-xs ml-1" style={{ color: C.muted }}>(NT$ {money(extraNtd)})</span>
              </span>
              <span style={{ color: C.muted }}>＝</span>
              <span className="font-bold text-base" style={{ color: C.gold }}>
                合計 ₱ {money(totalPhp)}
                <span className="text-xs font-normal ml-1" style={{ color: C.muted }}>(NT$ {money(totalNtd)})</span>
              </span>
            </div>
          )}
        </div>

        {/* 老師分項表 */}
        <TeacherBreakdownTable
          periodKey={periodKey}
          lessons={lessons}
          teachers={teachers}
          accountById={accountById}
          phpRate={phpRate}
        />

        {/* 額外費用明細 */}
        {extras.length > 0 && (
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ background: C.amberSoft, border: `1px solid ${C.goldSoft}` }}
          >
            <div className="text-xs font-semibold" style={{ color: C.amber }}>額外費用明細</div>
            {extras.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-sm flex-wrap">
                <div>
                  <span className="font-medium" style={{ color: C.navy }}>
                    {teacherById[e.teacher_id || ""]?.teacher_name || "未指定"}
                  </span>
                  {e.note && <span className="ml-1.5" style={{ color: C.text }}>· {e.note}</span>}
                  <span className="ml-1.5 text-xs" style={{ color: C.muted }}>{e.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: C.gold }}>₱ {money(e.amount_php)}</span>
                  <span className="text-xs" style={{ color: C.muted }}>(NT$ {money(e.amount_ntd)})</span>
                  <button
                    className="text-xs"
                    style={{ color: C.red }}
                    onClick={() => handleDeleteExtra(e)}
                  >
                    刪除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lee 淨收入 */}
        <div className="flex justify-end pt-1" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="text-sm text-right">
            <span style={{ color: C.muted }}>Lee 本期淨收入 </span>
            <span className="font-semibold" style={{ color: C.green }}>
              NT$ {money(totalLeeNtd)}
            </span>
            {extraNtd > 0 && (
              <div className="text-xs" style={{ color: C.muted }}>
                (= 課程淨收 {money(totalLeeNtd + extraNtd)} − 額外費用 {money(extraNtd)})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
