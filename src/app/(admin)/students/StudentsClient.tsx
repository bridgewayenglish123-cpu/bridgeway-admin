"use client";

import { useState, useTransition, useMemo } from "react";
import { C } from "@/lib/constants";
import { todayYMD } from "@/lib/utils";
import type { Student, Teacher, Account, Lesson, Enrollment, StudentStatus } from "@/lib/supabase/types";
import DetailModal from "./DetailModal";
import PageIntro from "@/components/ui/PageIntro";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import {
  createStudent, updateStudent, setStudentStatus,
  importStudentsCSV, deleteStudent,
} from "@/app/actions/students";

type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialAccount = Pick<Account, "id" | "student_id" | "course_label" | "is_trial" | "total_lessons" | "status_override" | "billing_type">;
type PartialLesson = Pick<Lesson, "id" | "student_id" | "account_id" | "status" | "is_active">;

interface Props {
  students: Student[];
  teachers: PartialTeacher[];
  accounts: PartialAccount[];
  lessons: PartialLesson[];
  enrollments: Pick<Enrollment, "id" | "student_id" | "snapshot">[];
}

type ModalState =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; student: Student }
  | { kind: "detail"; student: Student }
  | { kind: "csv" }
  | { kind: "confirm-delete-warn"; student: Student }
  | { kind: "confirm-delete-final"; student: Student };

const STATUS_LABEL: Record<StudentStatus, string> = {
  Active: "在學", Paused: "暫停中", Closed: "已結束",
};

const EMPTY_FORM = {
  zh_name: "", en_name: "", zoom_email: "",
  contact_info: "", age: "", current_teacher_id: "",
};

// ── CSV utility ───────────────────────────────────────────────────────────────
function escapeCell(v: string) {
  if (/[,"\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function downloadCSV(filename: string, headers: string[], rows: (string | number)[]) {
  const lines = [headers, ...rows.map((r) => r)].map((row) =>
    (Array.isArray(row) ? row : [row]).map((c) => escapeCell(String(c ?? ""))).join(",")
  );
  const csv = "\uFEFF" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
      style={{ background: ok ? C.green : C.red, color: "#fff", maxWidth: 320 }}>
      {msg}
    </div>
  );
}

function StudentForm({
  initial, teachers, onSave, onCancel, isPending,
}: {
  initial: typeof EMPTY_FORM;
  teachers: PartialTeacher[];
  onSave: (d: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const activeTeachers = teachers.filter((t) => t.active_status === "Active");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            中文姓名 <span style={{ color: C.red }}>*</span>
          </label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.zh_name} onChange={(e) => set("zh_name", e.target.value)}
            placeholder="e.g. 王小明" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>英文名</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.en_name} onChange={(e) => set("en_name", e.target.value)}
            placeholder="e.g. Andy" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Zoom Email</label>
        <input className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={form.zoom_email} onChange={(e) => set("zoom_email", e.target.value)}
          placeholder="zoom@example.com" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>聯絡資訊</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.contact_info} onChange={(e) => set("contact_info", e.target.value)}
            placeholder="LINE / 電話" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>年齡 / 年段</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.age} onChange={(e) => set("age", e.target.value)}
            placeholder="e.g. 國中生 / 8" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>目前老師</label>
        <select className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={form.current_teacher_id}
          onChange={(e) => set("current_teacher_id", e.target.value)}>
          <option value="">— 未指定 —</option>
          {activeTeachers.map((t) => (
            <option key={t.id} value={t.id}>{t.teacher_name}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Btn kind="ghost" size="sm" onClick={onCancel} disabled={isPending}>取消</Btn>
        <Btn kind="primary" size="sm"
          disabled={!form.zh_name.trim() || isPending}
          onClick={() => onSave(form)}>
          {isPending ? "儲存中…" : "儲存"}
        </Btn>
      </div>
    </div>
  );
}

function CsvImportPanel({
  onDone, onCancel, existingNames,
}: {
  onDone: (msg: string) => void;
  onCancel: () => void;
  existingNames: Set<string>;
}) {
  const [step, setStep] = useState<"select" | "preview">("select");
  const [isPending, start] = useTransition();
  const [parseResult, setParseResult] = useState<{
    rows: { zh_name: string; en_name: string | null; zoom_email: string | null; contact_info: string | null; age: string | null; status: string }[];
    errors: { line: number; msg: string }[];
    skipped: { line: number; name: string }[];
  } | null>(null);

  const statusMap: Record<string, string> = {
    "在學": "Active", "暫停": "Paused", "結束": "Closed",
    "active": "Active", "paused": "Paused", "closed": "Closed",
  };

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        cells.push(current); current = "";
      } else { current += c; }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  };

  const parseCsv = (text: string) => {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { rows: [], errors: [{ line: 1, msg: "檔案內容不足" }], skipped: [] };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
    const findIdx = (candidates: string[]) =>
      candidates.map((c) => c.toLowerCase()).map((c) => headers.indexOf(c)).find((i) => i >= 0) ?? -1;

    const idx = {
      zh_name: findIdx(["中文姓名", "姓名", "zh_name", "name"]),
      en_name: findIdx(["英文名", "en_name"]),
      zoom_email: findIdx(["email", "zoom_email", "zoom"]),
      contact_info: findIdx(["聯絡方式", "contact_info", "contact"]),
      age: findIdx(["年齡", "age"]),
      status: findIdx(["狀態", "status"]),
    };

    if (idx.zh_name < 0) {
      return { rows: [], errors: [{ line: 1, msg: "找不到「中文姓名」欄位,請確認 CSV 標題列" }], skipped: [] };
    }

    const rows: { zh_name: string; en_name: string | null; zoom_email: string | null; contact_info: string | null; age: string | null; status: string }[] = [];
    const errors: { line: number; msg: string }[] = [];
    const skipped: { line: number; name: string }[] = [];
    const newNames = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const cells = parseLine(lines[i]);
      const zh_name = cells[idx.zh_name]?.trim();
      if (!zh_name) { errors.push({ line: i + 1, msg: "中文姓名為空" }); continue; }
      if (existingNames.has(zh_name) || newNames.has(zh_name)) {
        skipped.push({ line: i + 1, name: zh_name }); continue;
      }
      newNames.add(zh_name);
      const statusRaw = idx.status >= 0 ? (cells[idx.status]?.trim() || "") : "";
      const status = statusMap[statusRaw] || statusMap[statusRaw.toLowerCase()] || "Active";
      rows.push({
        zh_name,
        en_name: idx.en_name >= 0 ? cells[idx.en_name]?.trim() || null : null,
        zoom_email: idx.zoom_email >= 0 ? cells[idx.zoom_email]?.trim() || null : null,
        contact_info: idx.contact_info >= 0 ? cells[idx.contact_info]?.trim() || null : null,
        age: idx.age >= 0 ? cells[idx.age]?.trim() || null : null,
        status,
      });
    }
    return { rows, errors, skipped };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCsv(text);
      setParseResult(result);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = () => {
    if (!parseResult || parseResult.rows.length === 0) return;
    start(async () => {
      const res = await importStudentsCSV(parseResult.rows as any);
      if (res.error) onDone("匯入失敗:" + res.error);
      else onDone(`成功匯入 ${res.count} 位學生`);
    });
  };

  return (
    <div className="space-y-4">
      {step === "select" && (
        <>
          <div className="rounded-lg p-3 text-xs" style={{ background: "#EAF0F6", color: C.navy, lineHeight: 1.9 }}>
            <div><strong>支援中英欄名:</strong> 中文姓名 / zh_name / name / 姓名</div>
            <div><strong>狀態欄:</strong> 在學 / 暫停 / 結束(或 Active/Paused/Closed),不填預設在學</div>
            <div><strong>去重:</strong> 同名學生自動略過,不會重複建立</div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>選擇 CSV 檔案</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="w-full text-sm"
              style={{ color: C.text }}
            />
          </div>
          <div className="flex justify-end">
            <Btn kind="ghost" size="sm" onClick={onCancel}>取消</Btn>
          </div>
        </>
      )}

      {step === "preview" && parseResult && (
        <>
          {/* 統計 */}
          <div className="flex gap-3 text-sm flex-wrap">
            <span style={{ color: C.green }}>新增 {parseResult.rows.length} 位</span>
            {parseResult.skipped.length > 0 && (
              <span style={{ color: C.amber }}>略過重複 {parseResult.skipped.length} 位</span>
            )}
            {parseResult.errors.length > 0 && (
              <span style={{ color: C.red }}>錯誤 {parseResult.errors.length} 筆</span>
            )}
          </div>

          {/* 錯誤 */}
          {parseResult.errors.length > 0 && (
            <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: C.redSoft, color: C.red }}>
              {parseResult.errors.map((e, i) => (
                <div key={i}>第 {e.line} 列:{e.msg}</div>
              ))}
            </div>
          )}

          {/* 略過 */}
          {parseResult.skipped.length > 0 && (
            <div className="rounded-lg p-3 text-xs" style={{ background: C.amberSoft, color: C.amber }}>
              略過(已存在):{parseResult.skipped.map((s) => s.name).join("、")}
            </div>
          )}

          {/* 預覽表格(前 30) */}
          {parseResult.rows.length > 0 && (
            <div className="rounded-lg overflow-auto text-xs" style={{ border: `1px solid ${C.line}`, maxHeight: 200 }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#EAF0F6" }}>
                    {["中文姓名","英文名","Email","聯絡","狀態"].map((h) => (
                      <th key={h} className="px-2 py-1 text-left" style={{ color: C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.slice(0, 30).map((row, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td className="px-2 py-1" style={{ color: C.text }}>{row.zh_name}</td>
                      <td className="px-2 py-1" style={{ color: C.muted }}>{row.en_name || "—"}</td>
                      <td className="px-2 py-1" style={{ color: C.muted }}>{row.zoom_email || "—"}</td>
                      <td className="px-2 py-1" style={{ color: C.muted }}>{row.contact_info || "—"}</td>
                      <td className="px-2 py-1" style={{ color: C.muted }}>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Btn kind="ghost" size="sm" onClick={() => { setStep("select"); setParseResult(null); }}>
              重新選檔
            </Btn>
            <Btn
              kind="gold"
              size="sm"
              disabled={parseResult.rows.length === 0 || isPending}
              onClick={handleImport}
            >
              {isPending ? "匯入中…" : `確認匯入 ${parseResult.rows.length} 位學生`}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

export default function StudentsClient({ students, teachers, accounts, lessons, enrollments }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  // #5: 預設「在學」
  const [filterStatus, setFilterStatus] = useState<StudentStatus | "">( "Active");
  const [filterTeacher, setFilterTeacher] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  const closeModal = () => setModal({ kind: "none" });

  const teacherById = useMemo(
    () => Object.fromEntries(teachers.map((t) => [t.id, t])),
    [teachers]
  );

  // 帳戶剩餘計算
  const getStudentRemaining = (sid: string) =>
    accounts
      .filter((a) => a.student_id === sid && !a.is_trial && a.status_override !== "Closed")
      .reduce((sum, a) => {
        const completed = lessons.filter(
          (l) => l.account_id === a.id && l.is_active && l.status === "completed"
        ).length;
        return sum + Math.max(0, a.total_lessons - completed);
      }, 0);

  const getStudentAccountCount = (sid: string) =>
    accounts.filter((a) => a.student_id === sid).length;

  const filtered = useMemo(() => {
    let list = students;
    if (filterStatus) list = list.filter((s) => s.status === filterStatus);
    if (filterTeacher) list = list.filter((s) => s.current_teacher_id === filterTeacher);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.zh_name.toLowerCase().includes(q) ||
        (s.en_name || "").toLowerCase().includes(q) ||
        (s.zoom_email || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, filterStatus, filterTeacher, search]);

  // #6 CSV 匯出
  const handleExportCsv = () => {
    const rows = filtered.map((s) => [
      s.zh_name,
      s.en_name || "",
      s.zoom_email || "",
      s.contact_info || "",
      s.age || "",
      STATUS_LABEL[s.status] || s.status,
      teacherById[s.current_teacher_id || ""]?.teacher_name || "",
      String(getStudentRemaining(s.id)),
    ]);
    downloadCSV(
      `bridgeway-students-${todayYMD()}.csv`,
      ["中文姓名", "英文名", "Email", "聯絡方式", "年齡", "狀態", "當前老師", "剩餘堂數"],
      rows as any
    );
  };

  const handleSave = (form: typeof EMPTY_FORM) => {
    startTransition(async () => {
      const res = modal.kind === "edit"
        ? await updateStudent(modal.student.id, form)
        : await createStudent(form);
      if (res.error) showToast(res.error, false);
      else { showToast(modal.kind === "edit" ? "已更新學生資料" : "已新增學生"); closeModal(); }
    });
  };

  const handleStatusChange = (student: Student, status: StudentStatus) => {
    startTransition(async () => {
      const res = await setStudentStatus(student.id, status);
      if (res.error) showToast(res.error, false);
      else showToast(`${student.zh_name} 狀態已更新`);
    });
  };

  // #7 刪除
  const handleDeleteConfirm = (student: Student) => {
    const stuAccounts = accounts.filter((a) => a.student_id === student.id);
    const completed = lessons.filter(
      (l) => l.student_id === student.id && l.is_active && l.status === "completed"
    ).length;
    if (stuAccounts.length > 0 || completed > 0) {
      setModal({ kind: "confirm-delete-warn", student });
    } else {
      setModal({ kind: "confirm-delete-final", student });
    }
  };

  const handleDeleteFinal = (student: Student) => {
    startTransition(async () => {
      const res = await deleteStudent(student.id);
      if (res.error) showToast(res.error, false);
      else { showToast(`已刪除 ${student.zh_name}`); closeModal(); }
    });
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en"
          style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>學生管理</h2>
          <div className="flex gap-2 flex-wrap">
            <Btn kind="ghost" size="md" onClick={handleExportCsv}>CSV 匯出</Btn>
            <Btn kind="ghost" size="md" onClick={() => setModal({ kind: "csv" })}>批次匯入</Btn>
            <Btn kind="gold" size="md" onClick={() => setModal({ kind: "add" })}>+ 新增學生</Btn>
          </div>
        </div>
      </div>

      <PageIntro storageKey="students" title="學生管理 · 說明">
        <p>管理所有學生基本資料與學習狀態。</p>
        <p>• 狀態可直接在列表下拉切換。點「詳情」可查看課程帳戶與剩餘堂數。</p>
        <p>• CSV 匯出只匯出目前 filter 後的結果。</p>
      </PageIntro>

      {/* 篩選列 */}
      <div className="flex flex-wrap gap-2">
        <input
          className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-40"
          style={{ borderColor: C.line, color: C.text }}
          placeholder="搜尋姓名 / Email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StudentStatus | "")}>
          <option value="Active">在學</option>
          <option value="Paused">暫停中</option>
          <option value="Closed">已結束</option>
          <option value="">全部</option>
        </select>
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}>
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
            {students.length === 0 ? "還沒有任何學生。" : "沒有符合條件的學生。"}
          </Empty>
        ) : (
          <Table head={["姓名", "老師", "狀態", "剩餘堂數", "帳戶", "操作"]}>
            {filtered.map((s) => (
              <tr key={s.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                <Td>
                  <div className="font-medium" style={{ color: C.navy }}>{s.zh_name}</div>
                  {s.en_name && <div className="text-xs" style={{ color: C.muted }}>{s.en_name}</div>}
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
                    disabled={isPending}>
                    <option value="Active">在學</option>
                    <option value="Paused">暫停中</option>
                    <option value="Closed">已結束</option>
                  </select>
                </Td>
                <Td>
                  <span className="text-sm font-medium"
                    style={{ color: getStudentRemaining(s.id) > 0 ? C.navy : C.muted }}>
                    {getStudentRemaining(s.id) > 0 ? `${getStudentRemaining(s.id)} 堂` : "—"}
                  </span>
                </Td>
                <Td>
                  <span className="text-sm" style={{ color: C.muted }}>
                    {getStudentAccountCount(s.id)}
                  </span>
                </Td>
                <Td>
                  <div className="flex gap-1.5 flex-wrap">
                    <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "detail", student: s })}>詳情</Btn>
                    <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "edit", student: s })}>編輯</Btn>
                    <Btn kind="danger" size="sm" onClick={() => handleDeleteConfirm(s)}>刪除</Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Add/Edit Modal */}
      {(modal.kind === "add" || modal.kind === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md rounded-2xl p-5 md:p-6 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              {modal.kind === "add" ? "新增學生" : `編輯 · ${modal.student.zh_name}`}
            </h3>
            <StudentForm
              initial={modal.kind === "edit" ? {
                zh_name: modal.student.zh_name,
                en_name: modal.student.en_name || "",
                zoom_email: modal.student.zoom_email || "",
                contact_info: modal.student.contact_info || "",
                age: modal.student.age || "",
                current_teacher_id: modal.student.current_teacher_id || "",
              } : EMPTY_FORM}
              teachers={teachers}
              onSave={handleSave}
              onCancel={closeModal}
              isPending={isPending}
            />
          </div>
        </div>
      )}

      {/* #12 Detail Modal */}
      {modal.kind === "detail" && (
        <DetailModal
          student={modal.student}
          teachers={teachers}
          accounts={accounts as any}
          lessons={lessons as any}
          enrollments={enrollments}
          onClose={closeModal}
        />
      )}

      {/* CSV Modal */}
      {modal.kind === "csv" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-lg rounded-2xl p-5 md:p-6 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>批次匯入學生</h3>
            <CsvImportPanel
              onDone={(msg) => { showToast(msg, msg.includes("成功")); closeModal(); }}
              onCancel={closeModal}
              existingNames={new Set(students.map((s) => s.zh_name))}
            />
          </div>
        </div>
      )}

      {/* #7 刪除第一階段:建議改結束 */}
      {modal.kind === "confirm-delete-warn" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md rounded-2xl p-5 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.amber }}>建議改用「結束」</h3>
            <div className="text-sm whitespace-pre-line" style={{ color: C.text }}>
              {(() => {
                const s = modal.student;
                const stuAccounts = accounts.filter((a) => a.student_id === s.id);
                const completed = lessons.filter(
                  (l) => l.student_id === s.id && l.is_active && l.status === "completed"
                ).length;
                return `「${s.zh_name}」有紀錄：${
                  stuAccounts.length > 0 ? `
· ${stuAccounts.length} 個帳戶` : ""
                }${
                  completed > 0 ? `
· ${completed} 堂完課` : ""
                }

刪除會讓這些紀錄找不到對應學生,可能影響匯款統計和歷史查詢。

建議直接把狀態改為「結束」:學生從主要清單消失,但紀錄完整可查。

若真的要刪除,再按下方按鈕。`;
              })()}
            </div>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="good" size="sm" onClick={() => {
                handleStatusChange(modal.student, "Closed");
                closeModal();
              }}>改為結束</Btn>
              <Btn kind="danger" size="sm"
                onClick={() => setModal({ kind: "confirm-delete-final", student: modal.student })}>
                繼續刪除
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* #7 刪除第二階段:最終確認 */}
      {modal.kind === "confirm-delete-final" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.red }}>
              刪除學生 · 最後確認
            </h3>
            <p className="text-sm whitespace-pre-line" style={{ color: C.text }}>
              {`即將刪除「${modal.student.zh_name}」。

此動作不可復原。`}
            </p>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="danger" size="sm" disabled={isPending}
                onClick={() => handleDeleteFinal(modal.student)}>
                {isPending ? "刪除中…" : "確認刪除"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
