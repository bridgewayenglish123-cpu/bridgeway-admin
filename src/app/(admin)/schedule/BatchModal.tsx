"use client";

import { useState, useTransition, useMemo } from "react";
import { C, WD } from "@/lib/constants";
import type { Teacher, Account, Student, Lesson } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import { createBatchScheduleRules, generateLessonsForAccount } from "@/app/actions/schedule";

type PartialStudent = Pick<Student, "id" | "zh_name" | "en_name" | "status">;
type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialLesson = Pick<Lesson, "id" | "account_id" | "date" | "time" | "class_type" | "status" | "is_active">;

interface Props {
  accounts: Account[];
  students: PartialStudent[];
  teachers: PartialTeacher[];
  lessons: PartialLesson[];
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export default function BatchModal({ accounts, students, teachers, lessons, onDone, onError, onClose }: Props) {
  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const activeAccounts = useMemo(() =>
    accounts.filter((a) => a.status_override !== "Closed" && !a.is_trial),
    [accounts]
  );

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(25);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPending, startTransition] = useTransition();

  const getRemainingForAccount = (acc: Account) => {
    const completed = lessons.filter(
      (l) => l.account_id === acc.id && l.is_active && l.status === "completed"
    ).length;
    return acc.total_lessons - completed;
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  // 依選取帳戶的 teacher_type 決定老師選單(取第一個選取帳戶的類型)
  const firstSelectedAcc = accounts.find((a) => selectedAccountIds[0] === a.id);
  const filteredTeachers = teachers.filter(
    (t) =>
      t.active_status === "Active" &&
      (!firstSelectedAcc || t.teacher_type === firstSelectedAcc.teacher_type)
  );

  const canSave = selectedAccountIds.length > 0 && weekdays.length > 0 && time;

  const handleSave = () => {
    if (!canSave) return;
    startTransition(async () => {
      const items = selectedAccountIds.map((accId) => {
        const acc = accounts.find((a) => a.id === accId);
        return {
          account_id: accId,
          teacher_id: teacherId || null,
          weekdays,
          time,
          duration: acc?.duration_type === "Long55" ? 55 : duration,
          start_date: startDate || null,
          end_date: endDate || null,
        };
      });

      const res = await createBatchScheduleRules(items);
      if (res.error) { onError(res.error); return; }

      // 為每個帳戶生成排課
      let totalAdded = 0;
      for (const accId of selectedAccountIds) {
        const genRes = await generateLessonsForAccount(accId);
        if (genRes.ok) totalAdded += genRes.added || 0;
      }

      onDone(`已為 ${selectedAccountIds.length} 位學生建立規則並生成 ${totalAdded} 堂課`);
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
        <h3 className="text-base font-semibold" style={{ color: C.navy }}>批次排課(團體課)</h3>

        {/* 學生多選 */}
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: C.muted }}>
            學生(可多選) <span style={{ color: C.red }}>*</span>
          </label>
          <div
            className="rounded-lg border overflow-y-auto space-y-0.5 p-2"
            style={{ borderColor: C.line, maxHeight: 200 }}
          >
            {activeAccounts.map((a) => {
              const st = studentById[a.student_id];
              const remaining = getRemainingForAccount(a);
              const checked = selectedAccountIds.includes(a.id);
              return (
                <label
                  key={a.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm"
                  style={{ background: checked ? "#EAF0F6" : "transparent", color: C.text }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAccount(a.id)}
                  />
                  <span className="font-medium" style={{ color: C.navy }}>{st?.zh_name || "?"}</span>
                  <span style={{ color: C.muted }}>· {a.course_label}</span>
                  <span style={{ color: remaining > 0 ? C.green : C.muted, marginLeft: "auto" }}>
                    剩 {remaining} 堂
                  </span>
                </label>
              );
            })}
            {activeAccounts.length === 0 && (
              <div className="text-sm text-center py-3" style={{ color: C.muted }}>
                沒有進行中的帳戶。
              </div>
            )}
          </div>
          {selectedAccountIds.length > 0 && (
            <div className="text-xs mt-1" style={{ color: C.green }}>
              已選 {selectedAccountIds.length} 位學生
            </div>
          )}
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
            <option value="">— 未指定 —</option>
            {filteredTeachers.map((t) => (
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
                className="w-10 h-10 rounded-lg text-sm font-medium transition-colors"
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
            <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
              時長(分,依帳戶自動調整)
            </label>
            <div className="flex gap-3 pt-2">
              {[25, 55].map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: C.text }}>
                  <input type="radio" checked={duration === d} onChange={() => setDuration(d)} />
                  {d} 分
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 期間 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>開始日期(選填)</label>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>結束日期(選填)</label>
            <input
              type="date"
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: C.line, color: C.text }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Btn kind="ghost" size="sm" onClick={onClose} disabled={isPending}>取消</Btn>
          <Btn kind="primary" size="sm" disabled={!canSave || isPending} onClick={handleSave}>
            {isPending ? "建立中…" : `建立 ${selectedAccountIds.length} 條規則並生成排課`}
          </Btn>
        </div>
      </div>
    </div>
  );
}
