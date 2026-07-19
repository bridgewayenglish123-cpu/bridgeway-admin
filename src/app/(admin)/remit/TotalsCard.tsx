"use client";

import { useMemo } from "react";
import { C } from "@/lib/constants";
import { money } from "@/lib/utils";
import { effectiveHanneShare, effectiveLeeCommission } from "@/lib/domain";
import { classifyLesson } from "./RemitClient";
import type { Teacher, Account, Lesson } from "@/lib/supabase/types";
import Card from "@/components/ui/Card";
import { Table, Td, MobileCardList, MobileCard } from "@/components/ui/Table";

interface Props {
  teachers: Teacher[];
  lessons: Lesson[];
  accountById: Record<string, Account>;
  phpRate: number;
}

function downloadTotalsCsv(
  rows: { teacherName: string; trial: number; s25: number; l55: number; total: number; ntd: number; php: number }[]
) {
  const header = ["老師", "試聽堂", "25分堂", "55分堂", "總堂", "累計 NTD", "累計 PHP"];
  const csv = "\uFEFF" +
    [header, ...rows.map((r) => [r.teacherName, r.trial, r.s25, r.l55, r.total, r.ntd, r.php])]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bridgeway_teacher_totals_" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function TotalsCard({ teachers, lessons, accountById, phpRate }: Props) {
  const rows = useMemo(() => {
    const byTeacher: Record<string, {
      teacherName: string; trial: number; s25: number; l55: number;
      total: number; ntd: number; php: number;
    }> = {};

    const completedLessons = lessons.filter((l) => l.is_active && l.status === "completed");

    for (const l of completedLessons) {
      const tid = l.teacher_id || "__none__";
      if (!byTeacher[tid]) {
        const t = teachers.find((t) => t.id === tid);
        byTeacher[tid] = {
          teacherName: t?.teacher_name || "未知老師",
          trial: 0, s25: 0, l55: 0, total: 0, ntd: 0, php: 0,
        };
      }
      const row = byTeacher[tid];
      const cat = classifyLesson(l, accountById);
      if (cat === "trial") row.trial++;
      else if (cat === "s25") row.s25++;
      else row.l55++;
      row.total++;
      const payout = (l.payout_snapshot?.teacher_payout_ntd || 0) + effectiveHanneShare(l);
      row.ntd += payout;
      row.php += Math.round(payout * phpRate);
    }

    return Object.values(byTeacher).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }, [teachers, lessons, accountById, phpRate]);

  const grandTotal = {
    trial: rows.reduce((s, r) => s + r.trial, 0),
    s25: rows.reduce((s, r) => s + r.s25, 0),
    l55: rows.reduce((s, r) => s + r.l55, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    ntd: rows.reduce((s, r) => s + r.ntd, 0),
    php: rows.reduce((s, r) => s + r.php, 0),
  };

  return (
    <Card
      title="老師累計統計(全期間)"
      collapsible
      storageKey="teacher_totals"
      defaultCollapsed={true}
      right={
        <button
          className="text-xs px-2 py-1 rounded"
          style={{ background: "#EAF0F6", color: C.navy }}
          onClick={() => downloadTotalsCsv(rows)}
        >
          CSV 匯出
        </button>
      }
    >
      {rows.length === 0 ? (
        <div className="text-sm py-4 text-center" style={{ color: C.muted }}>
          尚無完課紀錄。
        </div>
      ) : (
        <>
        <Table head={["老師", "試聽 25分", "短課 25分", "完整 55分", "總堂", "累計 NTD", "累計 PHP"]} mobileCard>
          {rows.map((r) => (
            <tr key={r.teacherName} style={{ borderBottom: `1px solid ${C.line}` }}>
              <Td><span className="font-medium" style={{ color: C.navy }}>{r.teacherName}</span></Td>
              <Td><span style={{ color: r.trial > 0 ? C.text : C.muted }}>{r.trial > 0 ? r.trial : "—"}</span></Td>
              <Td><span style={{ color: r.s25 > 0 ? C.text : C.muted }}>{r.s25 > 0 ? r.s25 : "—"}</span></Td>
              <Td><span style={{ color: r.l55 > 0 ? C.text : C.muted }}>{r.l55 > 0 ? r.l55 : "—"}</span></Td>
              <Td><span className="font-semibold">{r.total}</span></Td>
              <Td><span style={{ color: C.navy }}>NT$ {money(r.ntd)}</span></Td>
              <Td><span style={{ color: C.gold }}>₱ {money(r.php)}</span></Td>
            </tr>
          ))}
          <tr style={{ background: "#EAF0F6" }}>
            <Td><span className="font-semibold" style={{ color: C.navy }}>合計</span></Td>
            <Td><span className="font-semibold">{grandTotal.trial}</span></Td>
            <Td><span className="font-semibold">{grandTotal.s25}</span></Td>
            <Td><span className="font-semibold">{grandTotal.l55}</span></Td>
            <Td><span className="font-semibold">{grandTotal.total}</span></Td>
            <Td><span className="font-semibold" style={{ color: C.navy }}>NT$ {money(grandTotal.ntd)}</span></Td>
            <Td><span className="font-semibold" style={{ color: C.gold }}>₱ {money(grandTotal.php)}</span></Td>
          </tr>
        </Table>

        <MobileCardList>
          {rows.map((r) => (
            <MobileCard key={r.teacherName}>
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[14px]" style={{ color: C.navy }}>{r.teacherName}</div>
                <div className="text-right">
                  <div className="font-semibold text-[14px]" style={{ color: C.navy }}>NT$ {money(r.ntd)}</div>
                  <div className="text-[12px]" style={{ color: C.gold }}>₱ {money(r.php)}</div>
                </div>
              </div>
              <div className="flex gap-3 text-[12px] mt-1" style={{ color: C.muted }}>
                {r.trial > 0 && <span>試聽 {r.trial}</span>}
                {r.s25 > 0 && <span>短課 {r.s25}</span>}
                {r.l55 > 0 && <span>完整 {r.l55}</span>}
                <span>共 {r.total} 堂</span>
              </div>
            </MobileCard>
          ))}
          <div className="rounded-xl p-3 mt-1" style={{ background: "#EAF0F6" }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[13px]" style={{ color: C.navy }}>合計 · {grandTotal.total} 堂</div>
              <div className="text-right">
                <div className="font-semibold" style={{ color: C.navy }}>NT$ {money(grandTotal.ntd)}</div>
                <div className="text-[12px]" style={{ color: C.gold }}>₱ {money(grandTotal.php)}</div>
              </div>
            </div>
          </div>
        </MobileCardList>
        </>
      )}
    </Card>
  );
}
