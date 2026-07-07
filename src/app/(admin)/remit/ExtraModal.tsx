"use client";

import { useState, useTransition } from "react";
import { C } from "@/lib/constants";
import { money, todayYMD } from "@/lib/utils";
import { periodOf } from "@/lib/domain";
import type { Teacher } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import { addExtra } from "@/app/actions/remit";

interface Props {
  periodKey: string;
  teachers: Teacher[];
  phpRate: number;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export default function ExtraModal({ periodKey, teachers, phpRate, onDone, onError, onClose }: Props) {
  const [teacherId, setTeacherId] = useState("");
  const [amountPhp, setAmountPhp] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayYMD());
  const [isPending, startTransition] = useTransition();

  const p = periodOf(periodKey);
  const php = parseFloat(amountPhp) || 0;
  const ntd = php > 0 ? Math.round(php / phpRate) : 0;
  const activeTeachers = teachers.filter((t) => t.active_status === "Active");

  const canSave = php > 0 && date;

  const handleSave = () => {
    if (!canSave) return;
    startTransition(async () => {
      const res = await addExtra({
        period_key: periodKey,
        teacher_id: teacherId || null,
        amount_php: php,
        note,
        date,
        php_rate: phpRate,
      });
      if (res.error) onError(res.error);
      else onDone("已記錄額外費用");
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: "white", boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}
      >
        <h3 className="text-base font-semibold" style={{ color: C.navy }}>記錄額外費用</h3>

        {/* 所屬期間 */}
        <div className="rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "#EAF0F6", color: C.navy }}>
          所屬期間：{p.label}（匯款 {p.remit}）
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>老師</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">— 未指定(整組共同) —</option>
            {[...activeTeachers].sort((a,b) => a.teacher_name.localeCompare(b.teacher_name)).map((t) => (
              <option key={t.id} value={t.id}>{t.teacher_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            金額(PHP) <span style={{ color: C.red }}>*</span>
          </label>
          <input
            type="number"
            min="0"
            step="1"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={amountPhp}
            onChange={(e) => setAmountPhp(e.target.value)}
            placeholder="e.g. 500"
          />
          {php > 0 && (
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              ≈ NT$ {money(ntd)}（匯率 {phpRate}）
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>說明</label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 生日紅包 / 年度獎金 / 教材補助"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>日期</label>
          <input
            type="date"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Btn kind="ghost" size="sm" onClick={onClose} disabled={isPending}>取消</Btn>
          <Btn kind="gold" size="sm" disabled={!canSave || isPending} onClick={handleSave}>
            {isPending ? "儲存中…" : "儲存"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
