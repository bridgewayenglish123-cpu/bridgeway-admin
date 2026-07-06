"use client";

import { useState, useTransition, useMemo } from "react";
import { C, WD } from "@/lib/constants";
import type { Teacher, Account, Student, ScheduleRule, Lesson } from "@/lib/supabase/types";
import PageIntro from "@/components/ui/PageIntro";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import RuleModal from "./RuleModal";
import {
  toggleScheduleRule,
  deleteScheduleRule,
  generateLessonsForAccount,
  generateAll,
  deleteOrphanRules,
} from "@/app/actions/schedule";

type PartialStudent = Pick<Student, "id" | "zh_name" | "en_name" | "status">;
type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialLesson = Pick<Lesson, "id" | "account_id" | "date" | "time" | "class_type" | "status" | "is_active">;

interface Props {
  rules: ScheduleRule[];
  accounts: Account[];
  students: PartialStudent[];
  teachers: PartialTeacher[];
  lessons: PartialLesson[];
}

type ModalState =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; rule: ScheduleRule }
  | { kind: "confirm-generate-all" }
  | { kind: "confirm-toggle"; rule: ScheduleRule }
  | { kind: "confirm-delete"; rule: ScheduleRule }
  | { kind: "confirm-clean-orphans"; count: number };

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
      style={{ background: ok ? C.green : C.red, color: "#fff", maxWidth: 360 }}
    >
      {msg}
    </div>
  );
}

export default function ScheduleClient({ rules, accounts, students, teachers, lessons }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [hideInactive, setHideInactive] = useState(true);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };
  const closeModal = () => setModal({ kind: "none" });

  const accountById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);

  // 孤兒規則
  const accountIds = new Set(accounts.map((a) => a.id));
  const orphanRules = rules.filter((r) => !accountIds.has(r.account_id));

  // 篩選
  const filtered = useMemo(() => {
    let list = rules;
    if (hideInactive) list = list.filter((r) => r.active_status === "Active");
    if (filterTeacher) list = list.filter((r) => r.teacher_id === filterTeacher);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const acc = accountById[r.account_id];
        const st = acc ? studentById[acc.student_id] : null;
        const tc = teacherById[r.teacher_id || ""];
        return (
          st?.zh_name.toLowerCase().includes(q) ||
          st?.en_name?.toLowerCase().includes(q) ||
          tc?.teacher_name.toLowerCase().includes(q) ||
          r.time.includes(q)
        );
      });
    }
    return list;
  }, [rules, hideInactive, filterTeacher, search, accountById, studentById, teacherById]);

  // 計算剩餘堂數
  const getRemainingForAccount = (accId: string) => {
    const acc = accountById[accId];
    if (!acc) return 0;
    const completed = lessons.filter(
      (l) => l.account_id === accId && l.is_active && l.status === "completed"
    ).length;
    return acc.total_lessons - completed;
  };

  const handleToggle = (rule: ScheduleRule) => {
    startTransition(async () => {
      const newStatus = rule.active_status === "Active" ? "Inactive" : "Active";
      const res = await toggleScheduleRule(rule.id, newStatus as any);
      if (res.error) showToast(res.error, false);
      else showToast(newStatus === "Active" ? "已啟用規則" : "已停用規則");
      closeModal();
    });
  };

  const handleDelete = (rule: ScheduleRule) => {
    startTransition(async () => {
      const res = await deleteScheduleRule(rule.id);
      if (res.error) showToast(res.error, false);
      else showToast("已刪除規則");
      closeModal();
    });
  };

  const handleGenerate = (rule: ScheduleRule) => {
    startTransition(async () => {
      const res = await generateLessonsForAccount(rule.account_id);
      if (res.error) showToast(res.error, false);
      else showToast(res.added === 0 ? "堂數已滿,無需生成" : `已生成 ${res.added} 堂課`);
    });
  };

  const handleGenerateAll = () => {
    startTransition(async () => {
      const res = await generateAll();
      if (res.error) showToast(res.error, false);
      else showToast(`已掃描 ${res.accountCount} 個帳戶,新增 ${res.totalAdded} 堂課`);
      closeModal();
    });
  };

  const handleCleanOrphans = () => {
    startTransition(async () => {
      const res = await deleteOrphanRules();
      if (res.error) showToast(res.error, false);
      else showToast(`已清理 ${res.deleted} 條孤兒規則`);
      closeModal();
    });
  };

  // 有生效規則的帳戶數
  const activeRuleAccountCount = new Set(
    rules.filter((r) => r.active_status === "Active").map((r) => r.account_id)
  ).size;

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 頁首 */}
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>排課管理</h2>
          <div className="flex gap-2 flex-wrap">
<Btn kind="gold" size="md" onClick={() => setModal({ kind: "confirm-generate-all" })}>
              一次生成全部
            </Btn>
            <Btn kind="primary" size="md" onClick={() => setModal({ kind: "add" })}>＋ 新增規則</Btn>
          </div>
        </div>
      </div>

      <PageIntro storageKey="schedule" title="排課管理 · 說明">
        <p>為每位學生設定每週固定時段,系統依規則自動生成課程。</p>
        <p>• <strong>新增規則</strong>:選帳戶、老師、週幾、時間,儲存後點「生成」產出實際課程。</p>
        <p>• <strong>一次生成全部</strong>:掃描所有生效帳戶,自動補齊剩餘堂數。</p>
        <p>• <strong>批次排課</strong>:多位學生同一時段(團體課),一次建立多條規則。</p>
        <p>• 停用規則不影響已生成的課程,只停止產出新課。</p>
      </PageIntro>

      {/* 孤兒規則警示 */}
      {orphanRules.length > 0 && (
        <div
          className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: C.redSoft, border: `1px solid ${C.red}` }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: C.red }}>
              ⚠ 發現 {orphanRules.length} 條排課規則的帳戶資料不見了
            </div>
            <div className="text-xs mt-0.5" style={{ color: C.red }}>
              這些規則無法生成課程,建議一鍵清理。
            </div>
          </div>
          <Btn
            kind="danger"
            size="sm"
            onClick={() => setModal({ kind: "confirm-clean-orphans", count: orphanRules.length })}
          >
            一鍵清理
          </Btn>
        </div>
      )}

      {/* 篩選列 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-40"
          style={{ borderColor: C.line, color: C.text }}
          placeholder="搜尋學生 / 老師 / 時間…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: C.muted }}>
          <input
            type="checkbox"
            checked={hideInactive}
            onChange={(e) => setHideInactive(e.target.checked)}
          />
          隱藏停用
        </label>
      </div>

      {/* 規則列表 */}
      <Card title={`排課規則(${filtered.length}${filtered.length !== rules.length ? ` / ${rules.length}` : ""})`}>
        {filtered.length === 0 ? (
          <Empty action={<Btn kind="primary" onClick={() => setModal({ kind: "add" })}>＋ 新增規則</Btn>}>
            {rules.length === 0 ? "還沒有任何排課規則。" : "沒有符合條件的規則。"}
          </Empty>
        ) : (
          <Table head={["學生", "課程方案", "週幾 · 時間 · 時長", "老師", "期間", "狀態", "操作"]}>
            {filtered.map((rule) => {
              const acc = accountById[rule.account_id];
              const student = acc ? studentById[acc.student_id] : null;
              const teacher = teacherById[rule.teacher_id || ""];
              const isActive = rule.active_status === "Active";
              const remaining = getRemainingForAccount(rule.account_id);
              const wdLabels = (rule.weekdays as number[])
                .sort()
                .map((d) => `週${WD[d]}`)
                .join("、");

              return (
                <tr
                  key={rule.id}
                  style={{ borderBottom: `1px solid ${C.line}`, opacity: isActive ? 1 : 0.5 }}
                >
                  <Td>
                    {student ? (
                      <>
                        <div className="font-medium" style={{ color: C.navy }}>{student.zh_name}</div>
                        {student.en_name && (
                          <div className="text-xs" style={{ color: C.muted }}>{student.en_name}</div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: C.red }}>— (帳戶不見)</span>
                    )}
                  </Td>
                  <Td>
                    {acc ? (
                      <>
                        <div className="text-sm" style={{ color: C.text }}>{acc.course_label}</div>
                        <div className="text-xs" style={{ color: remaining > 0 ? C.green : C.muted }}>
                          剩 {remaining} 堂
                        </div>
                      </>
                    ) : (
                      <span style={{ color: C.muted }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="text-sm font-medium" style={{ color: C.navy }}>{wdLabels}</div>
                    <div className="text-xs" style={{ color: C.muted }}>
                      {rule.time} · {rule.duration} 分
                    </div>
                  </Td>
                  <Td>
                    <span className="text-sm" style={{ color: C.text }}>
                      {teacher?.teacher_name || <span style={{ color: C.muted }}>—</span>}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs" style={{ color: C.muted }}>
                      {rule.start_date || "—"} ~ {rule.end_date || "無限期"}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={isActive ? "green" : "gray"}>
                      {isActive ? "啟用" : "停用"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {isActive && acc && (
                        <Btn kind="good" size="sm" disabled={isPending} onClick={() => handleGenerate(rule)}>
                          生成
                        </Btn>
                      )}
                      <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "edit", rule })}>
                        編輯
                      </Btn>
                      <Btn
                        kind="ghost"
                        size="sm"
                        onClick={() => setModal({ kind: "confirm-toggle", rule })}
                      >
                        {isActive ? "停用" : "啟用"}
                      </Btn>
                      <Btn
                        kind="danger"
                        size="sm"
                        onClick={() => setModal({ kind: "confirm-delete", rule })}
                      >
                        刪除
                      </Btn>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ── Modals ── */}
      {(modal.kind === "add" || modal.kind === "edit") && (
        <RuleModal
          rule={modal.kind === "edit" ? modal.rule : null}
          accounts={accounts}
          students={students}
          teachers={teachers}
          lessons={lessons}
          onDone={(msg) => { showToast(msg); closeModal(); }}
          onError={(msg) => showToast(msg, false)}
          onClose={closeModal}
        />
      )}

      {modal.kind === "confirm-generate-all" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md rounded-2xl p-5 space-y-4" style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>一次生成全部課程</h3>
            <div className="rounded-lg p-3 text-sm" style={{ background: "#EAF0F6", color: C.navy, lineHeight: 1.8 }}>
              即將掃描 <strong>{activeRuleAccountCount}</strong> 個有生效排課規則的帳戶,依剩餘堂數自動補齊排課。
              每個帳戶不超過總堂數上限,已存在的日期+時間不重複產生。
              此動作可能一次新增數十堂課,建議先確認排課規則都是最新的。
            </div>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="gold" size="sm" disabled={isPending} onClick={handleGenerateAll}>
                {isPending ? "生成中…" : "確認生成"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {modal.kind === "confirm-toggle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              {modal.rule.active_status === "Active" ? "停用" : "啟用"}排課規則？
            </h3>
            {modal.rule.active_status === "Active" && (
              <p className="text-sm" style={{ color: C.text }}>
                停用後不再自動生成新課,已生成的課程不受影響。
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn
                kind={modal.rule.active_status === "Active" ? "danger" : "good"}
                size="sm"
                disabled={isPending}
                onClick={() => handleToggle(modal.rule)}
              >
                {isPending ? "處理中…" : modal.rule.active_status === "Active" ? "確認停用" : "確認啟用"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {modal.kind === "confirm-delete" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.red }}>刪除排課規則？</h3>
            <p className="text-sm" style={{ color: C.text }}>
              已生成的課程不受影響,但之後不會再依此規則產出新課。
            </p>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="danger" size="sm" disabled={isPending} onClick={() => handleDelete(modal.rule)}>
                {isPending ? "刪除中…" : "確認刪除"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {modal.kind === "confirm-clean-orphans" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.red }}>清理孤兒規則</h3>
            <p className="text-sm" style={{ color: C.text }}>
              將刪除 <strong>{modal.count}</strong> 條找不到對應帳戶的規則。此操作無法復原。
            </p>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="danger" size="sm" disabled={isPending} onClick={handleCleanOrphans}>
                {isPending ? "清理中…" : "確認清理"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
