"use client";

import { useState, useTransition, useMemo } from "react";
import { C, WD } from "@/lib/constants";
import type { Teacher, Account, Student, ScheduleRule, Lesson } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import { createScheduleRule, updateScheduleRule, generateLessonsForAccount } from "@/app/actions/schedule";

type PartialStudent = Pick<Student, "id" | "zh_name" | "en_name" | "status">;
type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialLesson = Pick<Lesson, "id" | "account_id" | "date" | "time" | "class_type" | "status" | "is_active">;

interface Props {
  rule: ScheduleRule | null;
  accounts: Account[];
  students: PartialStudent[];
  teachers: PartialTeacher[];
  lessons: PartialLesson[];
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export default function RuleModal({ rule, accounts, students, teachers, lessons, onDone, onError, onClose }: Props) {
  const isEdit = !!rule;

  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  // 進行中帳戶
  const activeAccounts = useMemo(() =>
    accounts.filter((a) => {
      if (a.status_override === "Closed") return false;
      const completed = lessons.filter(
        (l) => l.account_id === a.id && l.is_active && l.status === "completed"
      ).length;
      return a.total_lessons - completed > 0;
    }),
    [accounts, lessons]
  );

  const getRemainingForAccount = (acc: Account) => {
    const completed = lessons.filter(
      (l) => l.account_id === acc.id && l.is_active && l.status === "completed"
    ).length;
    return acc.total_lessons - completed;
  };

  const [accountId, setAccountId] = useState(rule?.account_id || "");
  const [teacherId, setTeacherId] = useState(rule?.teacher_id || "");
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays || []);
  const [time, setTime] = useState(rule?.time || "");
  const [startDate, setStartDate] = useState(rule?.start_date || "");
  const [isPending, startTransition] = useTransition();

  const selectedAccount = accounts.find((a) => a.id === accountId);

  // 老師過濾:依帳戶 teacher_type
  const filteredTeachers = useMemo(() => {
    if (!selectedAccount) return teachers.filter((t) => t.active_status === "Active");
    return teachers.filter(
      (t) => t.active_status === "Active" && t.teacher_type === selectedAccount.teacher_type
    );
  }, [selectedAccount, teachers]);

  // 切換週幾
  const toggleWeekday = (d: number) => {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  // 帳戶選擇後自動帶入時長
  const selectedAccount2 = accounts.find((a) => a.id === accountId);
  const duration = selectedAccount2
    ? selectedAccount2.duration_type === "Long55" ? 55 : 25
    : (rule?.duration || 25);
  const durationLabel = duration === 55 ? "55 分鐘" : "25 分鐘";

  const handleAccountChange = (id: string) => {
    setAccountId(id);
    setTeacherId("");
  };

  const canSave = accountId && weekdays.length > 0 && time;

  const doSave = (andGenerate: boolean) => {
    if (!canSave) return;
    startTransition(async () => {
      const data = {
        account_id: accountId,
        teacher_id: teacherId || null,
        weekdays,
        time,
        duration,
        start_date: startDate || null,
        end_date: null,
      };

      const res = isEdit
        ? await updateScheduleRule(rule.id, data)
        : await createScheduleRule(data);

      if (res.error) { onError(res.error); return; }

      if (andGenerate) {
        const genRes = await generateLessonsForAccount(accountId);
        if (genRes.error) onError(genRes.error);
        else onDone(isEdit
          ? `已更新規則並生成 ${genRes.added} 堂課`
          : `已新增規則並生成 ${genRes.added} 堂課`
        );
      } else {
        onDone(isEdit ? "已更新排課規則" : "已新增排課規則");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-5 space-y-4 overflow-y-auto"
        style={{ background: "white", boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "92vh" }}
      >
        <h3 className="text-base font-semibold" style={{ color: C.navy }}>
          {isEdit ? "編輯排課規則" : "新增排課規則"}
        </h3>

        {/* 帳戶 */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            帳戶 <span style={{ color: C.red }}>*</span>
          </label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={accountId}
            onChange={(e) => handleAccountChange(e.target.value)}
            disabled={isEdit}
          >
            <option value="" disabled>選擇帳戶...</option>
            {[...activeAccounts].sort((a,b) => {
              const sa = studentById[a.student_id]?.zh_name || "";
              const sb = studentById[b.student_id]?.zh_name || "";
              return sa.localeCompare(sb, "zh-TW");
            }).map((a) => {
              const st = studentById[a.student_id];
              const remaining = getRemainingForAccount(a);
              const durLabel = a.duration_type === "Long55" ? "55分" : "25分";
              return (
                <option key={a.id} value={a.id}>
                  {st?.zh_name || "?"}{st?.en_name ? " (" + st.en_name + ")" : ""} · {durLabel} · 剩 {remaining} 堂
                </option>
              );
            })}
          </select>
        </div>

        {/* 老師 */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>老師</label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">— 未指定(選填) —</option>
            {[...filteredTeachers].sort((a,b) => a.teacher_name.localeCompare(b.teacher_name)).map((t) => (
              <option key={t.id} value={t.id}>{t.teacher_name}</option>
            ))}
          </select>
        </div>

        {/* 週幾 */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: C.muted }}>
            週幾 <span style={{ color: C.red }}>*</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {[0,1,2,3,4,5,6].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleWeekday(d)}
                className="w-11 h-11 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: weekdays.includes(d) ? C.navy : "#EAF0F6",
                  color: weekdays.includes(d) ? "#fff" : C.navy,
                }}
              >
                {WD[d]}
              </button>
            ))}
          </div>
        </div>

        {/* 時間 + 時長 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
              時間 <span style={{ color: C.red }}>*</span>
            </label>
            <input
              type="time"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>時長(分)(依帳戶自動帶入)</label>
            <div className="rounded-lg px-3 py-2 text-sm font-medium" style={{ background: "#EAF0F6", color: C.navy }}>
              {durationLabel}
            </div>
          </div>
        </div>



        {/* 開始日期 */}
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            開始日期(選填，留空從今天起)
          </label>
          <input
            type="date"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* 三顆按鈕 */}
        <div className="flex justify-end gap-2 pt-1">
          <Btn kind="ghost" size="sm" onClick={onClose} disabled={isPending}>取消</Btn>
          <Btn kind="ghost" size="sm" disabled={!canSave || isPending} onClick={() => doSave(false)}>
            {isPending ? "儲存中…" : "只儲存規則"}
          </Btn>
          <Btn kind="primary" size="sm" disabled={!canSave || isPending} onClick={() => doSave(true)}>
            {isPending ? "生成中…" : "儲存並生成排課"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
