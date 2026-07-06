"use client";

import { useState, useTransition, useRef } from "react";
import { C } from "@/lib/constants";
import type { Student, Teacher, Account, Lesson, StudentStatus } from "@/lib/supabase/types";
import PageIntro from "@/components/ui/PageIntro";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import {
  createStudent,
  updateStudent,
  setStudentStatus,
  importStudentsCSV,
} from "@/app/actions/students";

type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialAccount = Pick<Account, "id" | "student_id" | "course_label" | "is_trial" | "total_lessons" | "status_override" | "billing_type">;
type PartialLesson = Pick<Lesson, "id" | "student_id" | "account_id" | "status" | "is_active">;

interface Props {
  students: Student[];
  teachers: PartialTeacher[];
  accounts: PartialAccount[];
  lessons: PartialLesson[];
}

type ModalState =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; student: Student }
  | { kind: "detail"; student: Student }
  | { kind: "csv" };

const EMPTY_FORM = {
  zh_name: "",
  en_name: "",
  zoom_email: "",
  contact_info: "",
  age: "",
  current_teacher_id: "",
};

const STATUS_LABEL: Record<StudentStatus, string> = {
  Active: "學習中",
  Paused: "暫停中",
  Closed: "已結束",
};

const STATUS_TONE: Record<StudentStatus, "green" | "amber" | "gray"> = {
  Active: "green",
  Paused: "amber",
  Closed: "gray",
};

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
      style={{ background: ok ? C.green : C.red, color: "#fff", maxWidth: 320 }}
    >
      {msg}
    </div>
  );
}

function StudentForm({
  initial,
  teachers,
  onSave,
  onCancel,
  isPending,
}: {
  initial: typeof EMPTY_FORM;
  teachers: PartialTeacher[];
  onSave: (d: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));
  const activeTeachers = teachers.filter((t) => t.active_status === "Active");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            中文姓名 <span style={{ color: C.red }}>*</span>
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.zh_name}
            onChange={(e) => set("zh_name", e.target.value)}
            placeholder="e.g. 王小明"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            英文名
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.en_name}
            onChange={(e) => set("en_name", e.target.value)}
            placeholder="e.g. Andy"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
          Zoom Email
        </label>
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={form.zoom_email}
          onChange={(e) => set("zoom_email", e.target.value)}
          placeholder="zoom@example.com"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            聯絡資訊
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.contact_info}
            onChange={(e) => set("contact_info", e.target.value)}
            placeholder="LINE / 電話"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            年齡 / 年段
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
            placeholder="e.g. 國中生 / 8"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
          目前老師
        </label>
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={form.current_teacher_id}
          onChange={(e) => set("current_teacher_id", e.target.value)}
        >
          <option value="">— 未指定 —</option>
          {activeTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.teacher_name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Btn kind="ghost" size="sm" onClick={onCancel} disabled={isPending}>取消</Btn>
        <Btn
          kind="primary"
          size="sm"
          disabled={!form.zh_name.trim() || isPending}
          onClick={() => onSave(form)}
        >
          {isPending ? "儲存中…" : "儲存"}
        </Btn>
      </div>
    </div>
  );
}

function CsvImportPanel({
  onDone,
  onCancel,
}: {
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [isPending, start] = useTransition();
  const [preview, setPreview] = useState<string[][]>([]);

  const parse = (text: string) => {
    const lines = text.trim().split("\n").filter(Boolean);
    return lines.map((l) => l.split(",").map((c) => c.trim()));
  };

  const handleParse = () => setPreview(parse(raw));

  const handleImport = () => {
    const rows = parse(raw).map((cols) => ({
      zh_name: cols[0] || "",
      en_name: cols[1] || "",
      zoom_email: cols[2] || "",
      contact_info: cols[3] || "",
      age: cols[4] || "",
    })).filter((r) => r.zh_name);

    start(async () => {
      const res = await importStudentsCSV(rows);
      if (res.error) onDone("匯入失敗:" + res.error);
      else onDone(`成功匯入 ${res.count} 位學生`);
    });
  };

  return (
    <div className="space-y-3">
      <div className="text-xs rounded-lg p-3" style={{ background: "#EAF0F6", color: C.navy, lineHeight: 1.8 }}>
        <strong>CSV 格式</strong>(逗號分隔,每行一位):<br />
        中文姓名, 英文名, Zoom Email, 聯絡資訊, 年齡<br />
        <span style={{ color: C.muted }}>例: 王小明, Andy, andy@gmail.com, LINE:andy, 國中生</span>
      </div>
      <textarea
        className="w-full rounded-lg border px-3 py-2 text-sm font-mono resize-none"
        style={{ borderColor: C.line, color: C.text }}
        rows={6}
        placeholder={"王小明, Andy, andy@gmail.com, LINE:andy, 國中生\n李曉華, Lily, lily@gmail.com, 0912-345-678, 7"}
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setPreview([]); }}
      />
      {preview.length > 0 && (
        <div className="text-xs rounded-lg overflow-auto" style={{ border: `1px solid ${C.line}`, maxHeight: 160 }}>
          <table className="w-full" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#EAF0F6" }}>
                {["中文姓名","英文名","Zoom","聯絡","年齡"].map((h) => (
                  <th key={h} className="px-2 py-1 text-left" style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.filter((r) => r[0]).map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  {[0,1,2,3,4].map((ci) => (
                    <td key={ci} className="px-2 py-1" style={{ color: C.text }}>{row[ci] || "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" size="sm" onClick={onCancel}>取消</Btn>
        {preview.length === 0 ? (
          <Btn kind="ghost" size="sm" disabled={!raw.trim()} onClick={handleParse}>預覽</Btn>
        ) : (
          <Btn kind="primary" size="sm" disabled={isPending} onClick={handleImport}>
            {isPending ? "匯入中…" : `匯入 ${preview.filter((r) => r[0]).length} 位`}
          </Btn>
        )}
      </div>
    </div>
  );
}

function DetailModal({
  student,
  accounts,
  lessons,
  teachers,
  onClose,
}: {
  student: Student;
  accounts: PartialAccount[];
  lessons: PartialLesson[];
  teachers: PartialTeacher[];
  onClose: () => void;
}) {
  const sAccounts = accounts.filter((a) => a.student_id === student.id);
  const teacherById = Object.fromEntries(teachers.map((t) => [t.id, t]));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-5 md:p-6 space-y-4 overflow-y-auto"
        style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "90vh" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: C.navy }}>{student.zh_name}</h3>
            {student.en_name && (
              <div className="text-sm" style={{ color: C.muted }}>{student.en_name}</div>
            )}
          </div>
          <button onClick={onClose} className="text-xl" style={{ color: C.muted }}>×</button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
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

        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: C.muted, letterSpacing: "0.05em" }}>
            課程帳戶({sAccounts.length})
          </div>
          {sAccounts.length === 0 ? (
            <div className="text-sm" style={{ color: C.muted }}>尚無課程帳戶。</div>
          ) : (
            <div className="space-y-2">
              {sAccounts.map((a) => {
                const aLessons = lessons.filter((l) => l.account_id === a.id && l.is_active);
                const completed = aLessons.filter((l) => l.status === "completed").length;
                const remaining = a.total_lessons - completed;
                const isClosed = a.status_override === "Closed";
                return (
                  <div
                    key={a.id}
                    className="rounded-lg p-3 flex items-center justify-between gap-2"
                    style={{ border: `1px solid ${C.line}`, opacity: isClosed ? 0.6 : 1 }}
                  >
                    <div>
                      <div className="text-sm font-medium" style={{ color: C.navy }}>
                        {a.course_label}
                        {a.is_trial && (
                          <Badge tone="gold">試聽</Badge>
                        )}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                        已完 {completed} / 共 {a.total_lessons} 堂
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold" style={{ color: remaining > 0 ? C.navy : C.muted }}>
                        {remaining}
                      </div>
                      <div className="text-xs" style={{ color: C.muted }}>剩餘</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Btn kind="ghost" size="sm" onClick={onClose}>關閉</Btn>
        </div>
      </div>
    </div>
  );
}

export default function StudentsClient({ students, teachers, accounts, lessons }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<StudentStatus | "">("");
  const [filterTeacher, setFilterTeacher] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  const closeModal = () => setModal({ kind: "none" });

  const teacherById = Object.fromEntries(teachers.map((t) => [t.id, t]));

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      s.zh_name.toLowerCase().includes(q) ||
      (s.en_name || "").toLowerCase().includes(q) ||
      (s.zoom_email || "").toLowerCase().includes(q);
    const matchStatus = !filterStatus || s.status === filterStatus;
    const matchTeacher = !filterTeacher || s.current_teacher_id === filterTeacher;
    return matchQ && matchStatus && matchTeacher;
  });

  const handleSave = (form: typeof EMPTY_FORM) => {
    startTransition(async () => {
      const res =
        modal.kind === "edit"
          ? await updateStudent(modal.student.id, form)
          : await createStudent(form);
      if (res.error) showToast(res.error, false);
      else {
        showToast(modal.kind === "edit" ? "已更新學生資料" : "已新增學生");
        closeModal();
      }
    });
  };

  const handleStatusChange = (student: Student, status: StudentStatus) => {
    startTransition(async () => {
      const res = await setStudentStatus(student.id, status);
      if (res.error) showToast(res.error, false);
      else showToast(`${student.zh_name} 狀態已更新為「${STATUS_LABEL[status]}」`);
    });
  };

  const getStudentSummary = (sid: string) => {
    const sAccounts = accounts.filter((a) => a.student_id === sid && !a.status_override);
    const totalRemaining = sAccounts.reduce((sum, a) => {
      const completed = lessons.filter(
        (l) => l.account_id === a.id && l.is_active && l.status === "completed"
      ).length;
      return sum + Math.max(0, a.total_lessons - completed);
    }, 0);
    return { accountCount: sAccounts.length, totalRemaining };
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>學生管理</h2>
          <div className="flex gap-2">
            <Btn kind="ghost" size="md" onClick={() => setModal({ kind: "csv" })}>
              批次匯入 CSV
            </Btn>
            <Btn kind="gold" size="md" onClick={() => setModal({ kind: "add" })}>
              + 新增學生
            </Btn>
          </div>
        </div>
      </div>

      <PageIntro storageKey="students" title="學生管理 · 說明">
        <p>管理所有學生基本資料與學習狀態。</p>
        <p>• 狀態可直接在列表下拉切換:學習中 / 暫停中 / 已結束。</p>
        <p>• 點「詳情」可查看該學生的所有課程帳戶與剩餘堂數。</p>
        <p>• 批次匯入 CSV 格式:中文姓名, 英文名, Zoom Email, 聯絡資訊, 年齡。</p>
      </PageIntro>

      {/* 搜尋與篩選 */}
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-40"
          style={{ borderColor: C.line, color: C.text }}
          placeholder="搜尋姓名 / 英文名 / Email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StudentStatus | "")}
        >
          <option value="">全部狀態</option>
          <option value="Active">學習中</option>
          <option value="Paused">暫停中</option>
          <option value="Closed">已結束</option>
        </select>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
        >
          <option value="">全部老師</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.teacher_name}</option>
          ))}
        </select>
      </div>

      <Card
        title={`學生列表(${filtered.length}${filtered.length !== students.length ? ` / ${students.length}` : ""})`}
      >
        {filtered.length === 0 ? (
          <Empty action={<Btn kind="gold" onClick={() => setModal({ kind: "add" })}>+ 新增學生</Btn>}>
            {students.length === 0 ? "還沒有任何學生。點右上角新增第一位。" : "沒有符合條件的學生。"}
          </Empty>
        ) : (
          <Table head={["姓名", "老師", "狀態", "剩餘堂數", "帳戶數", "操作"]}>
            {filtered.map((s) => {
              const { accountCount, totalRemaining } = getStudentSummary(s.id);
              return (
                <tr key={s.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <Td>
                    <div className="font-medium" style={{ color: C.navy }}>{s.zh_name}</div>
                    {s.en_name && (
                      <div className="text-xs" style={{ color: C.muted }}>{s.en_name}</div>
                    )}
                  </Td>
                  <Td>
                    <span className="text-sm" style={{ color: C.text }}>
                      {teacherById[s.current_teacher_id || ""]?.teacher_name || (
                        <span style={{ color: C.muted }}>—</span>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <select
                      className="rounded border px-1.5 py-1 text-xs"
                      style={{ borderColor: C.line, color: C.text }}
                      value={s.status}
                      onChange={(e) => handleStatusChange(s, e.target.value as StudentStatus)}
                      disabled={isPending}
                    >
                      <option value="Active">學習中</option>
                      <option value="Paused">暫停中</option>
                      <option value="Closed">已結束</option>
                    </select>
                  </Td>
                  <Td>
                    <span
                      className="text-sm font-medium"
                      style={{ color: totalRemaining > 0 ? C.navy : C.muted }}
                    >
                      {totalRemaining > 0 ? `${totalRemaining} 堂` : "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm" style={{ color: C.muted }}>{accountCount}</span>
                  </Td>
                  <Td>
                    <div className="flex gap-1.5 flex-wrap">
                      <Btn
                        kind="ghost"
                        size="sm"
                        onClick={() => setModal({ kind: "detail", student: s })}
                      >
                        詳情
                      </Btn>
                      <Btn
                        kind="ghost"
                        size="sm"
                        onClick={() => setModal({ kind: "edit", student: s })}
                      >
                        編輯
                      </Btn>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* Add / Edit Modal */}
      {(modal.kind === "add" || modal.kind === "edit") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 md:p-6 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}
          >
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              {modal.kind === "add" ? "新增學生" : `編輯 · ${modal.student.zh_name}`}
            </h3>
            <StudentForm
              initial={
                modal.kind === "edit"
                  ? {
                      zh_name: modal.student.zh_name,
                      en_name: modal.student.en_name || "",
                      zoom_email: modal.student.zoom_email || "",
                      contact_info: modal.student.contact_info || "",
                      age: modal.student.age || "",
                      current_teacher_id: modal.student.current_teacher_id || "",
                    }
                  : EMPTY_FORM
              }
              teachers={teachers}
              onSave={handleSave}
              onCancel={closeModal}
              isPending={isPending}
            />
          </div>
        </div>
      )}

      {/* CSV Modal */}
      {modal.kind === "csv" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-5 md:p-6 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}
          >
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>批次匯入學生(CSV)</h3>
            <CsvImportPanel
              onDone={(msg) => { showToast(msg, msg.includes("成功")); closeModal(); }}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal.kind === "detail" && (
        <DetailModal
          student={modal.student}
          accounts={accounts}
          lessons={lessons}
          teachers={teachers}
          onClose={closeModal}
        />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
