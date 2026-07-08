"use client";

import { useState, useTransition } from "react";
import { C } from "@/lib/constants";
import type { Teacher, TeacherType, ActiveStatus } from "@/lib/supabase/types";
import { useConfirm } from "@/components/ConfirmProvider";
import PageIntro from "@/components/ui/PageIntro";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import {
  createTeacher, updateTeacher, setTeacherStatus, deleteTeacher,
} from "@/app/actions/teachers";

interface Stats {
  total: number;
  completed: number;
  upcoming: number;
  activeRules: number;
}

interface Props {
  teachers: Teacher[];
  stats: Record<string, Stats>;
}

type ModalState =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; teacher: Teacher };

const EMPTY_FORM = {
  teacher_name: "", teacher_code: "", teacher_type: "Other" as TeacherType,
  email: "", notes: "",
};

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
      style={{ background: ok ? C.green : C.red, color: "#fff", maxWidth: 320 }}>
      {msg}
    </div>
  );
}

function TeacherForm({ initial, onSave, onCancel, isPending }: {
  initial: typeof EMPTY_FORM;
  onSave: (d: typeof EMPTY_FORM) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof typeof EMPTY_FORM, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            姓名 <span style={{ color: C.red }}>*</span>
          </label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={form.teacher_name} onChange={(e) => set("teacher_name", e.target.value)}
            placeholder="e.g. Hanne" />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>代碼</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm uppercase"
            style={{ borderColor: C.line, color: C.text }}
            value={form.teacher_code} onChange={(e) => set("teacher_code", e.target.value)}
            placeholder="e.g. HN" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>類型</label>
        <div className="flex gap-3">
          {(["Hanne", "Other"] as TeacherType[]).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: C.text }}>
              <input type="radio" checked={form.teacher_type === t} onChange={() => set("teacher_type", t)} />
              {t === "Hanne" ? "Hanne(獨立方案)" : "其他老師"}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>Email</label>
        <input className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={form.email} onChange={(e) => set("email", e.target.value)}
          placeholder="teacher@example.com" />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>備註</label>
        <textarea className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
          style={{ borderColor: C.line, color: C.text }}
          rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Btn kind="ghost" size="sm" onClick={onCancel} disabled={isPending}>取消</Btn>
        <Btn kind="primary" size="sm" disabled={!form.teacher_name.trim() || isPending}
          onClick={() => onSave(form)}>
          {isPending ? "儲存中…" : "儲存"}
        </Btn>
      </div>
    </div>
  );
}

export default function TeachersClient({ teachers, stats }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { askConfirm } = useConfirm();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  const closeModal = () => setModal({ kind: "none" });

  const handleSave = (form: typeof EMPTY_FORM) => {
    startTransition(async () => {
      const res = modal.kind === "edit"
        ? await updateTeacher(modal.teacher.id, form)
        : await createTeacher(form);
      if (res.error) showToast(res.error, false);
      else { showToast(modal.kind === "edit" ? "已更新老師資料" : "已新增老師"); closeModal(); }
    });
  };

  // #1 停用老師
  const handleDeactivate = (t: Teacher) => {
    const s = stats[t.id] || { activeRules: 0, upcoming: 0, completed: 0, total: 0 };
    askConfirm({
      title: "停用老師",
      message: `即將停用「${t.teacher_name}」

目前有 ${s.activeRules} 條生效的排課規則使用這位老師
有 ${s.upcoming} 堂已排定的課程(待上)

停用後這位老師會從下拉選單消失,不影響歷史紀錄。`,
      confirmLabel: "確認停用",
      onConfirm: async () => {
        const res = await setTeacherStatus(t.id, "Inactive");
        if (res.error) showToast(res.error, false);
        else showToast(`已停用 ${t.teacher_name}`);
      },
    });
  };

  // #2 啟用老師
  const handleActivate = (t: Teacher) => {
    askConfirm({
      title: "啟用老師",
      message: `即將啟用「${t.teacher_name}」,之後選單會出現他/她。`,
      confirmLabel: "確認啟用",
      onConfirm: async () => {
        const res = await setTeacherStatus(t.id, "Active");
        if (res.error) showToast(res.error, false);
        else showToast(`已啟用 ${t.teacher_name}`);
      },
    });
  };

  // #3 刪除老師(兩階段)
  const handleDelete = (t: Teacher) => {
    const s = stats[t.id] || { activeRules: 0, upcoming: 0, completed: 0, total: 0 };
    const hasRecords = s.completed > 0 || s.activeRules > 0;

    if (hasRecords) {
      askConfirm({
        title: "建議改用「停用」",
        message: `「${t.teacher_name}」有紀錄:
· ${s.completed} 堂完課
· ${s.activeRules} 條生效排課規則

刪除會讓這些紀錄找不到對應老師,可能影響匯款統計和歷史查詢。

建議直接把老師改為「停用」:選單不再出現,但紀錄完整可查。

若真的要刪除,再按下方按鈕。`,
        confirmLabel: "繼續刪除",
        danger: true,
        onConfirm: () => {
          askConfirm({
            title: "刪除老師 · 最後確認",
            message: `即將刪除「${t.teacher_name}」及相關資料關聯。

此動作不可復原。`,
            confirmLabel: "確認刪除",
            danger: true,
            onConfirm: async () => {
              const res = await deleteTeacher(t.id);
              if (res.error) showToast(res.error, false);
              else showToast(`已刪除 ${t.teacher_name}`);
            },
          });
        },
      });
    } else {
      askConfirm({
        title: "刪除老師",
        message: `確定要刪除「${t.teacher_name}」嗎?

(這位老師沒有任何相關紀錄,可以安全刪除)`,
        confirmLabel: "刪除",
        danger: true,
        onConfirm: async () => {
          const res = await deleteTeacher(t.id);
          if (res.error) showToast(res.error, false);
          else showToast(`已刪除 ${t.teacher_name}`);
        },
      });
    }
  };

  const hanne = teachers.filter((t) => t.teacher_type === "Hanne");
  const others = teachers.filter((t) => t.teacher_type === "Other");

  const renderGroup = (group: Teacher[], groupLabel: string) => {
    if (group.length === 0) return null;
    return (
      <Card
        title={groupLabel}
        right={
          groupLabel === "其他老師" ? (
            <Btn kind="gold" size="sm" onClick={() => setModal({ kind: "add" })}>+ 新增老師</Btn>
          ) : null
        }
      >
        <Table head={["姓名", "代碼", "Email", "狀態", "完課", "待上", "排課規則", "操作"]}>
          {group.map((t) => {
            const s = stats[t.id] || { total: 0, completed: 0, upcoming: 0, activeRules: 0 };
            const isActive = t.active_status === "Active";
            return (
              <tr key={t.id} style={{ borderBottom: `1px solid ${C.line}`, opacity: isActive ? 1 : 0.55 }}>
                <Td>
                  <div className="font-medium" style={{ color: C.navy }}>{t.teacher_name}</div>
                  {t.notes && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{t.notes}</div>}
                </Td>
                <Td>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded" title="老師代碼" style={{ background: "#EAF0F6", color: C.navy }}>
                    {t.teacher_code || "—"}
                  </span>
                </Td>
                <Td><span className="text-xs" style={{ color: C.muted }}>{t.email || "—"}</span></Td>
                <Td><Badge tone={isActive ? "green" : "gray"}>{isActive ? "啟用中" : "已停用"}</Badge></Td>
                <Td><span className="text-sm font-medium" style={{ color: C.text }}>{s.completed}</span></Td>
                <Td><span className="text-sm" style={{ color: s.upcoming > 0 ? C.gold : C.muted }}>{s.upcoming}</span></Td>
                <Td><span className="text-sm" style={{ color: s.activeRules > 0 ? C.navy : C.muted }}>{s.activeRules}</span></Td>
                <Td>
                  <div className="flex gap-1.5 flex-wrap">
                    <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "edit", teacher: t })}>編輯</Btn>
                    {isActive
                      ? <Btn kind="ghost" size="sm" onClick={() => handleDeactivate(t)}>停用</Btn>
                      : <Btn kind="ghost" size="sm" onClick={() => handleActivate(t)}>啟用</Btn>
                    }
                    <Btn kind="danger" size="sm" onClick={() => handleDelete(t)}>刪除</Btn>
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    );
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>老師管理</h2>
          <Btn kind="gold" size="md" onClick={() => setModal({ kind: "add" })}>+ 新增老師</Btn>
        </div>
      </div>

      <PageIntro storageKey="teachers" title="老師管理 · 說明">
        <p>管理所有教師的基本資料、啟用狀態。</p>
        <p>• <strong>Hanne</strong> 與其他老師使用不同的價格方案,抽成結構不同。</p>
        <p>• 停用老師不影響歷史課程紀錄,只是不會再出現在新排課的選項中。</p>
        <p>• 有課程紀錄或排課規則的老師無法直接刪除,請先停用。</p>
      </PageIntro>

      {teachers.length === 0 ? (
        <Card>
          <Empty action={<Btn kind="gold" onClick={() => setModal({ kind: "add" })}>+ 新增第一位老師</Btn>}>
            還沒有任何老師。點右上角新增第一位。
          </Empty>
        </Card>
      ) : (
        <>
          {renderGroup(hanne, "Hanne")}
          {renderGroup(others, "其他老師")}
        </>
      )}

      {(modal.kind === "add" || modal.kind === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="w-full max-w-md rounded-2xl p-5 md:p-6 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              {modal.kind === "add" ? "新增老師" : `編輯老師 · ${modal.teacher.teacher_name}`}
            </h3>
            <TeacherForm
              initial={modal.kind === "edit" ? {
                teacher_name: modal.teacher.teacher_name,
                teacher_code: modal.teacher.teacher_code,
                teacher_type: modal.teacher.teacher_type,
                email: modal.teacher.email || "",
                notes: modal.teacher.notes || "",
              } : EMPTY_FORM}
              onSave={handleSave}
              onCancel={closeModal}
              isPending={isPending}
            />
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
