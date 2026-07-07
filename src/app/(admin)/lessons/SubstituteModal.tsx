"use client";

import { useState, useTransition, useMemo } from "react";
import { C } from "@/lib/constants";
import { money } from "@/lib/utils";
import { isPostHanneCutoff } from "@/lib/domain";
import type { Lesson, Teacher, Account, PriceRule, PayoutSnapshot } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { substituteLesson, substituteLessons } from "@/app/actions/lessons";

type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialAccount = Pick<Account, "id" | "student_id" | "course_label" | "teacher_type" | "course_family" | "duration_type" | "billing_type" | "snapshot">;

interface Props {
  lessons: Lesson[];
  account: PartialAccount;
  teachers: PartialTeacher[];
  priceRules: PriceRule[];
  phpRate: number;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

function effectiveLeeFromSnap(snap: PayoutSnapshot, date: string): number {
  const stored = snap.lee_commission_ntd || 0;
  if (isPostHanneCutoff(date)) return stored + (snap.hanne_share_ntd || 0);
  return stored;
}

export default function SubstituteModal({
  lessons, account, teachers, priceRules, phpRate, onDone, onError, onClose,
}: Props) {
  const [newTeacherId, setNewTeacherId] = useState("");
  const [selectedRuleCode, setSelectedRuleCode] = useState("");
  const [isPending, startTransition] = useTransition();

  const isBatch = lessons.length > 1;
  const sampleLesson = lessons[0];

  // 只列 active 老師,排除原老師
  const originalTeacherId = sampleLesson.teacher_id;
  const availableTeachers = teachers.filter(
    (t) => t.active_status === "Active" && t.id !== originalTeacherId
  );

  const newTeacher = teachers.find((t) => t.id === newTeacherId);

  // 兩層匹配
  const { strictMatches, looseMatches, matchMode } = useMemo(() => {
    if (!newTeacher) return { strictMatches: [], looseMatches: [], matchMode: "none" as const };

    const strict = priceRules.filter(
      (r) =>
        r.active_status === "Active" &&
        r.course_family === account.course_family &&
        r.duration_type === account.duration_type &&
        r.billing_type === account.billing_type &&
        r.teacher_type === newTeacher.teacher_type
    );

    if (strict.length > 0) {
      return { strictMatches: strict, looseMatches: [], matchMode: "strict" as const };
    }

    const loose = priceRules.filter(
      (r) => r.active_status === "Active" && r.teacher_type === newTeacher.teacher_type
    );

    if (loose.length > 0) {
      return { strictMatches: [], looseMatches: loose, matchMode: "loose" as const };
    }

    return { strictMatches: [], looseMatches: [], matchMode: "empty" as const };
  }, [newTeacher, priceRules, account]);

  // 自動預選嚴格匹配第一條
  const displayRules = matchMode === "strict" ? strictMatches : looseMatches;
  const effectiveRuleCode = selectedRuleCode || (matchMode === "strict" && strictMatches[0]?.price_rule_code) || "";
  const selectedRule = priceRules.find((r) => r.price_rule_code === effectiveRuleCode);

  // 新 snapshot 預覽
  const newSnapshot: PayoutSnapshot | null = selectedRule && newTeacher
    ? {
        original_price_ntd: account.snapshot?.original_price_ntd || 0,
        lesson_count: account.snapshot?.lesson_count || 1,
        teacher_payout_ntd: selectedRule.teacher_payout_ntd,
        hanne_share_ntd: isPostHanneCutoff(sampleLesson.date) ? 0 : selectedRule.hanne_share_ntd,
        lee_commission_ntd:
          Math.round((account.snapshot?.original_price_ntd || 0) / (account.snapshot?.lesson_count || 1)) -
          selectedRule.teacher_payout_ntd -
          (isPostHanneCutoff(sampleLesson.date) ? 0 : selectedRule.hanne_share_ntd),
      }
    : null;

  const canSave = newTeacherId && effectiveRuleCode && newSnapshot;

  const handleSave = () => {
    if (!canSave || !newSnapshot) return;
    startTransition(async () => {
      const res = isBatch
        ? await substituteLessons(lessons.map((l) => l.id), newTeacherId, newSnapshot)
        : await substituteLesson(sampleLesson.id, newTeacherId, newSnapshot);
      if (res.error) onError(res.error);
      else onDone(isBatch ? `已代課 ${lessons.length} 堂` : "已代課");
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4 overflow-y-auto"
        style={{ background: "white", boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "92vh" }}
      >
        <h3 className="text-base font-semibold" style={{ color: C.navy }}>
          {isBatch ? `批次代課 · ${lessons.length} 堂` : "代課"}
        </h3>

        {/* 原費率 */}
        <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: "#F7F5EF", color: C.navy }}>
          <div className="font-semibold mb-1">原費率</div>
          <div className="flex justify-between">
            <span>老師薪資</span>
            <span>NT$ {money(sampleLesson.payout_snapshot?.teacher_payout_ntd)}</span>
          </div>
          <div className="flex justify-between">
            <span>Lee 收入</span>
            <span>NT$ {money(effectiveLeeFromSnap(sampleLesson.payout_snapshot, sampleLesson.date))}</span>
          </div>
        </div>

        {/* 選新老師 */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            新老師 <span style={{ color: C.red }}>*</span>
          </label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={newTeacherId}
            onChange={(e) => { setNewTeacherId(e.target.value); setSelectedRuleCode(""); }}
          >
            <option value="" disabled>選擇代課老師...</option>
            {[...availableTeachers].sort((a,b) => a.teacher_name.localeCompare(b.teacher_name)).map((t) => (
              <option key={t.id} value={t.id}>
                {t.teacher_name} ({t.teacher_type})
              </option>
            ))}
          </select>
        </div>

        {/* 匹配結果 */}
        {newTeacher && matchMode === "empty" && (
          <div className="rounded-lg p-3 text-sm" style={{ background: C.redSoft, color: C.red }}>
            此老師類別沒有任何生效中的價格規則。請先到價格規則頁新增。
          </div>
        )}

        {newTeacher && matchMode === "loose" && (
          <div className="rounded-lg p-3 text-sm" style={{ background: C.amberSoft, color: C.amber }}>
            找不到完全匹配的規則(帳戶:{account.course_family}/{account.duration_type}/{account.billing_type})。
            下面列出 {newTeacher.teacher_type} 老師的全部規則,請手動選最接近的。
          </div>
        )}

        {newTeacher && matchMode !== "empty" && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
              費率規則 <span style={{ color: C.red }}>*</span>
              {matchMode === "strict" && (
                <span className="ml-1 font-normal" style={{ color: C.green }}>
                  (已自動匹配)
                </span>
              )}
            </label>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={effectiveRuleCode}
              onChange={(e) => setSelectedRuleCode(e.target.value)}
            >
              <option value="">— 選擇規則 —</option>
              {displayRules.map((r) => (
                <option key={r.price_rule_code} value={r.price_rule_code}>
                  {r.display_name} · 師 NT${money(r.teacher_payout_ntd)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 新費率預覽 */}
        {newSnapshot && (
          <div className="rounded-lg p-3 text-xs space-y-1.5" style={{ background: C.greenSoft, color: C.navy }}>
            <div className="font-semibold mb-1" style={{ color: C.green }}>
              新費用結構(依 {newTeacher?.teacher_type} 老師方案)
            </div>
            <div className="flex justify-between">
              <span>學生付</span>
              <span className="font-medium">NT$ {money(account.snapshot?.original_price_ntd || 0)}(不變,依原帳戶)</span>
            </div>
            <div className="flex justify-between">
              <span>代課老師抽成({newTeacher?.teacher_name})</span>
              <span className="font-medium">
                <span style={{ color: C.gold }}>₱ {money(Math.round(newSnapshot.teacher_payout_ntd * phpRate))}</span>
                <span style={{ color: C.muted }}> (NT$ {money(newSnapshot.teacher_payout_ntd)}) / 這堂</span>
              </span>
            </div>
            {!isPostHanneCutoff(sampleLesson.date) && newSnapshot.hanne_share_ntd > 0 ? (
              <div className="flex justify-between">
                <span>Hanne 抽成</span>
                <span>
                  <span style={{ color: C.gold }}>₱ {money(Math.round(newSnapshot.hanne_share_ntd * phpRate))}</span>
                  <span style={{ color: C.muted }}> (NT$ {money(newSnapshot.hanne_share_ntd)})</span>
                </span>
              </div>
            ) : (
              <div className="flex justify-between" style={{ color: C.muted }}>
                <span>Hanne 抽成</span>
                <span>₱ 0 (NT$ 0){isPostHanneCutoff(sampleLesson.date) ? " ※7/5 後歸 Lee" : ""}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-0.5" style={{ borderTop: `1px solid ${C.line}`, color: C.green }}>
              <span>Lee 淨收 / 這堂</span>
              <span>NT$ {money(effectiveLeeFromSnap(newSnapshot, sampleLesson.date))}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Btn kind="ghost" size="sm" onClick={onClose} disabled={isPending}>取消</Btn>
          <Btn kind="primary" size="sm" disabled={!canSave || isPending} onClick={handleSave}>
            {isPending ? "處理中…" : isBatch ? `確認代課 ${lessons.length} 堂` : "確認代課"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
