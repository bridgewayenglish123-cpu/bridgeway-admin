"use client";

import { useMemo } from "react";
import { C } from "@/lib/constants";
import { todayYMD, money } from "@/lib/utils";
import type { Student, Teacher, Account, Lesson, Enrollment } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";

type PartialTeacher = Pick<Teacher, "id" | "teacher_name">;
type PartialAccount = Pick<Account, "id" | "student_id" | "course_label" | "is_trial" | "total_lessons" | "status_override" | "start_lesson_date">;
type PartialLesson = Pick<Lesson, "id" | "student_id" | "account_id" | "teacher_id" | "original_teacher_id" | "date" | "time" | "class_type" | "status" | "is_active" | "is_substitute" | "note">;
type PartialEnrollment = Pick<Enrollment, "id" | "student_id" | "snapshot">;

interface Props {
  student: Student;
  teachers: PartialTeacher[];
  accounts: PartialAccount[];
  lessons: PartialLesson[];
  enrollments: PartialEnrollment[];
  onClose: () => void;
}

const CLASS_LABEL: Record<string, string> = { general: "一般", makeup: "補課", extension: "延伸" };
const CLASS_TONE: Record<string, "gray" | "amber" | "navy"> = { general: "gray", makeup: "amber", extension: "navy" };
const STATUS_TONE: Record<string, "green" | "red" | "gray"> = {
  completed: "green", cancelled: "red", scheduled: "gray",
};
const STATUS_LABEL: Record<string, string> = {
  completed: "已完成", cancelled: "已取消", scheduled: "待上",
};
const ACCOUNT_STATUS = (acc: PartialAccount, completedCount: number): { label: string; tone: "green" | "gold" | "gray" | "navy" } => {
  if (acc.status_override === "Closed") return { label: "已結束", tone: "gray" };
  const remaining = acc.total_lessons - completedCount;
  if (remaining <= 0) return { label: "已完課", tone: "navy" };
  if (acc.is_trial) return { label: "試聽中", tone: "gold" };
  return { label: "進行中", tone: "green" };
};

export default function DetailModal({ student, teachers, accounts, lessons, enrollments, onClose }: Props) {
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);
  const today = todayYMD();

  const stuAccounts = useMemo(
    () => accounts.filter((a) => a.student_id === student.id)
      .sort((a, b) => (b.start_lesson_date || "").localeCompare(a.start_lesson_date || "")),
    [accounts, student.id]
  );

  const getCompleted = (accId: string) =>
    lessons.filter((l) => l.account_id === accId && l.is_active && l.status === "completed").length;

  // 即將到來 8 堂
  const upcoming = useMemo(
    () => lessons
      .filter((l) => l.student_id === student.id && l.is_active && l.status === "scheduled" && l.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 8),
    [lessons, student.id, today]
  );

  // 最近 8 堂完課
  const recent = useMemo(
    () => lessons
      .filter((l) => l.student_id === student.id && l.is_active && l.status === "completed")
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
      .slice(0, 8),
    [lessons, student.id]
  );

  // 有備註最近 5 堂
  const noted = useMemo(
    () => lessons
      .filter((l) => l.student_id === student.id && l.is_active && l.note)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
      .slice(0, 5),
    [lessons, student.id]
  );

  // 總計
  const totalCompleted = lessons.filter(
    (l) => l.student_id === student.id && l.is_active && l.status === "completed"
  ).length;
  const stuEnrollments = enrollments.filter((e) => e.student_id === student.id);
  const totalSpent = stuEnrollments.reduce(
    (s, e) => s + ((e.snapshot as any)?.original_price_ntd || 0),
    0
  );

  const STATUS_MAP: Record<string, string> = { Active: "在學", Paused: "暫停中", Closed: "已結束" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-y-auto"
        style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 md:p-6" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: C.navy }}>{student.zh_name}</h3>
            {student.en_name && <div className="text-sm" style={{ color: C.muted }}>{student.en_name}</div>}
          </div>
          <button onClick={onClose} className="text-xl ml-4" style={{ color: C.muted }}>×</button>
        </div>

        <div className="p-5 md:p-6 space-y-5">
          {/* 基本資料 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {[
              ["Zoom", student.zoom_email || "—"],
              ["聯絡", student.contact_info || "—"],
              ["年齡", student.age || "—"],
              ["老師", teacherById[student.current_teacher_id || ""]?.teacher_name || "—"],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg p-2.5" style={{ background: "#F7F5EF" }}>
                <div className="text-xs" style={{ color: C.muted }}>{label}</div>
                <div style={{ color: C.text }}>{val}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={student.status === "Active" ? "green" : student.status === "Paused" ? "amber" : "gray"}>
              {STATUS_MAP[student.status] || student.status}
            </Badge>
          </div>

          {/* 課程帳戶 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>
              課程帳戶({stuAccounts.length})
            </div>
            {stuAccounts.length === 0 ? (
              <div className="text-sm" style={{ color: C.muted }}>尚無課程帳戶。</div>
            ) : (
              <Table head={["方案", "進度", "剩餘", "狀態", "開始日"]}>
                {stuAccounts.map((a) => {
                  const completed = getCompleted(a.id);
                  const remaining = a.total_lessons - completed;
                  const { label, tone } = ACCOUNT_STATUS(a, completed);
                  return (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <Td><span className="text-sm" style={{ color: C.navy }}>{a.course_label}</span></Td>
                      <Td><span className="text-xs" style={{ color: C.muted }}>{completed}/{a.total_lessons}</span></Td>
                      <Td>
                        <span className="font-medium" style={{ color: remaining > 0 ? C.navy : C.muted }}>
                          {remaining > 0 ? remaining : "—"}
                        </span>
                      </Td>
                      <Td><Badge tone={tone}>{label}</Badge></Td>
                      <Td><span className="text-xs" style={{ color: C.muted }}>{a.start_lesson_date || "—"}</span></Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </div>

          {/* 即將到來 8 堂 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>
              即將到來({upcoming.length} 堂)
            </div>
            {upcoming.length === 0 ? (
              <div className="text-sm" style={{ color: C.muted }}>目前沒有排定的課程。</div>
            ) : (
              <Table head={["日期", "時間", "老師", "類型"]}>
                {upcoming.map((l) => (
                  <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <Td>{l.date}</Td>
                    <Td><span style={{ color: C.muted }}>{l.time || "—"}</span></Td>
                    <Td>{teacherById[l.teacher_id || ""]?.teacher_name || "—"}</Td>
                    <Td><Badge tone={CLASS_TONE[l.class_type] || "gray"}>{CLASS_LABEL[l.class_type] || l.class_type}</Badge></Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>

          {/* 最近 8 堂完課 */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>
              最近完課({recent.length} 堂)
            </div>
            {recent.length === 0 ? (
              <div className="text-sm" style={{ color: C.muted }}>尚無完課紀錄。</div>
            ) : (
              <Table head={["日期", "時間", "老師", "類型"]}>
                {recent.map((l) => {
                  const teacher = teacherById[l.teacher_id || ""];
                  const origTeacher = teacherById[l.original_teacher_id || ""];
                  return (
                    <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <Td>{l.date}</Td>
                      <Td><span style={{ color: C.muted }}>{l.time || "—"}</span></Td>
                      <Td>
                        <div className="text-sm">{teacher?.teacher_name || "—"}</div>
                        {l.is_substitute && origTeacher && (
                          <div className="text-xs" style={{ color: C.amber }}>代:{origTeacher.teacher_name}</div>
                        )}
                      </Td>
                      <Td>
                        <div className="flex gap-1 flex-wrap">
                          <Badge tone={CLASS_TONE[l.class_type] || "gray"}>{CLASS_LABEL[l.class_type] || l.class_type}</Badge>
                          {l.is_substitute && <Badge tone="navy">代課</Badge>}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </div>

          {/* 有備註的最近 5 堂 */}
          {noted.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>備註紀錄</div>
              <div className="space-y-1.5">
                {noted.map((l) => (
                  <div key={l.id} className="text-xs" style={{ color: C.text, lineHeight: 1.6 }}>
                    <span style={{ color: C.muted }}>{l.date} {l.time}</span>
                    {" · "}
                    {l.note}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 總計 */}
          <div className="grid grid-cols-3 gap-3 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <div className="text-center">
              <div className="text-xs" style={{ color: C.muted }}>總花費</div>
              <div className="font-semibold" style={{ color: C.navy }}>NT$ {money(totalSpent)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs" style={{ color: C.muted }}>總完課</div>
              <div className="font-semibold" style={{ color: C.navy }}>{totalCompleted} 堂</div>
            </div>
            <div className="text-center">
              <div className="text-xs" style={{ color: C.muted }}>帳戶數</div>
              <div className="font-semibold" style={{ color: C.navy }}>{stuAccounts.length}</div>
            </div>
          </div>

          <div className="flex justify-end">
            <Btn kind="ghost" size="sm" onClick={onClose}>關閉</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
