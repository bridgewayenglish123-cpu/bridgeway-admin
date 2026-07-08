"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/constants";
import { todayYMD, weekRange, money } from "@/lib/utils";
import { isPostHanneCutoff, effectiveLeeCommission } from "@/lib/domain";
import type { Lesson, Student, Teacher, Account, PriceRule, PayoutSnapshot } from "@/lib/supabase/types";
import PageIntro from "@/components/ui/PageIntro";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import CancelModal from "./CancelModal";
import SubstituteModal from "./SubstituteModal";
import BatchBar from "./BatchBar";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  markLessonCompleted,
  markLessonsCompleted,
  revertLessonToScheduled,
  cancelLessons,
  undoSubstitute,
  updateLessonNote,
} from "@/app/actions/lessons";

type Tab = "today" | "week" | "overdue" | "all";

type PartialStudent = Pick<Student, "id" | "zh_name" | "en_name">;
type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialAccount = Pick<Account, "id" | "student_id" | "course_label" | "teacher_type" | "course_family" | "duration_type" | "billing_type" | "snapshot">;

interface Props {
  lessons: Lesson[];
  students: PartialStudent[];
  teachers: PartialTeacher[];
  accounts: PartialAccount[];
  priceRules: PriceRule[];
  phpRate: number;
}

type ModalState =
  | { kind: "none" }
  | { kind: "cancel"; lesson: Lesson }
  | { kind: "substitute"; lessons: Lesson[]; account: PartialAccount }


function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
      style={{ background: ok ? C.green : C.red, color: "#fff", maxWidth: 340 }}
    >
      {msg}
    </div>
  );
}

const CLASS_TYPE_LABEL: Record<string, string> = {
  general: "一般", makeup: "補課", extension: "延伸", regular: "一般",
};
const CLASS_TYPE_TONE: Record<string, "gray" | "amber" | "navy"> = {
  general: "gray", makeup: "amber", extension: "navy",
};


export default function LessonsClient({ lessons, students, teachers, accounts, priceRules, phpRate }: Props) {
  const [tab, setTab] = useState<Tab>("today");
  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [onlyPending, setOnlyPending] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const router = useRouter();
  const { askConfirm, askThreeWay } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState("");

  const today = todayYMD();
  const wk = weekRange();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };
  const closeModal = () => setModal({ kind: "none" });

  // 索引
  const studentById = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);
  const accountById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  // 逾期數量
  const overdueCount = useMemo(
    () => lessons.filter((l) => l.is_active && l.status === "scheduled" && l.date < today).length,
    [lessons, today]
  );

  // 篩選
  const filtered = useMemo(() => {
    let list = lessons.filter((l) => l.is_active);
    if (!showCancelled) list = list.filter((l) => l.status !== "cancelled");

    if (tab === "today") {
      list = list.filter((l) => l.date === today);
      if (onlyPending) list = list.filter((l) => l.status === "scheduled");
    } else if (tab === "week") {
      list = list.filter((l) => l.date >= wk.start && l.date <= wk.end);
      if (onlyPending) list = list.filter((l) => l.status === "scheduled");
    } else if (tab === "overdue") {
      list = list.filter((l) => l.status === "scheduled" && l.date < today);
    } else if (tab === "all") {
      if (onlyPending) list = list.filter((l) => l.status === "scheduled");
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) => {
        const st = studentById[l.student_id];
        const tc = teacherById[l.teacher_id || ""];
        return (
          st?.zh_name.toLowerCase().includes(q) ||
          st?.en_name?.toLowerCase().includes(q) ||
          tc?.teacher_name.toLowerCase().includes(q)
        );
      });
    }

    // 排序:date asc, time asc
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || "").localeCompare(b.time || "");
    });
  }, [lessons, tab, search, showCancelled, onlyPending, today, wk, studentById, teacherById]);


  // 選取
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const selectAll = () => setSelected(new Set(filtered.map((l) => l.id)));
  const clearSelect = () => setSelected(new Set());

  const selectedLessons = filtered.filter((l) => selected.has(l.id));

  // ── 備註編輯 (#15) ───────────────────────────────────────────────────────────
  const saveNote = (lessonId: string) => {
    startTransition(async () => {
      const res = await updateLessonNote(lessonId, noteEdit);
      if (res.error) showToast(res.error, false);
      else { showToast("備註已儲存"); setEditingNoteId(null); }
    });
  };

  // ── CSV 匯出 (#16) ────────────────────────────────────────────────────────────
  const handleExportCsv = () => {
    const rows = filtered.map((l) => {
      const stu = studentById[l.student_id];
      const teacher = teacherById[l.teacher_id || ""];
      const origTeacher = teacherById[l.original_teacher_id || ""];
      return [
        l.date,
        l.time || "",
        stu?.zh_name || "",
        stu?.en_name || "",
        teacher?.teacher_name || "",
        l.is_substitute ? (origTeacher?.teacher_name || "") : "",
        ({ general: "一般", makeup: "補課", extension: "延伸" } as Record<string,string>)[l.class_type] || l.class_type,
        ({ scheduled: "待上", completed: "已完成", cancelled: "已取消" } as Record<string,string>)[l.status] || l.status,
        l.duration,
        l.payout_snapshot?.teacher_payout_ntd || 0,
        l.payout_snapshot?.hanne_share_ntd || 0,
        l.payout_snapshot?.lee_commission_ntd || 0,
        l.note || "",
      ];
    });
    const csv = "\uFEFF" + [
      ["日期","時間","中文姓名","英文名","老師","原老師(代課時)","類型","狀態","時長","老師抽成 NTD","Hanne 抽成 NTD","Lee 淨收入 NTD","備註"],
      ...rows,
    ].map((row) => row.map((c) => {
      const s = String(c ?? "");
      return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""')+'"' : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bridgeway-lessons-" + new Date().toISOString().slice(0,10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 動作 ──────────────────────────────────────────────────────────────────
  const handleComplete = (lessonId: string) => {
    startTransition(async () => {
      const res = await markLessonCompleted(lessonId);
      if (res.error) showToast(res.error, false);
      else showToast("已標記完成");
    });
  };

  const handleRevert = (lessonId: string) => {
    const l = filtered.find((x) => x.id === lessonId);
    if (!l) return;
    askConfirm({
      title: "改回待上",
      message: "即將把 " + l.date + " " + (l.time || "") + " 的課程改回「待上」。\n\n若已計入本期匯款,撤銷後匯款金額會即時調整。",
      confirmLabel: "確認改回",
      onConfirm: async () => {
        const res = await revertLessonToScheduled(lessonId);
        if (res.error) showToast(res.error, false);
        else showToast("已改回待上課");
      },
    });
  };

  const handleBatchComplete = () => {
    const ids = [...selected];
    const count = ids.length;
    askConfirm({
      title: "批次標記完成",
      message: "即將把已選 " + count + " 堂課程標記為完成。\n\n此動作可以個別用「↺ 改回待上」撤銷,但建議先確認選對了。",
      confirmLabel: "確認批次完成",
      onConfirm: async () => {
        const res = await markLessonsCompleted(ids);
        if (res.error) showToast(res.error, false);
        else { showToast("已完成 " + count + " 堂"); clearSelect(); }
      },
    });
  };

  const handleBatchCancel = () => {
    const count = selectedLessons.length;
    askConfirm({
      title: "批次取消",
      message: "即將取消已選 " + count + " 堂課程。\n\n每堂都會自動在 +7 天建立延伸課(維持堂數守恆)。\n若需指定補課日期,請改為單堂取消。",
      confirmLabel: "確認批次取消",
      danger: true,
      onConfirm: async () => {
        const res = await cancelLessons(selectedLessons.map((l) => l.id));
        if (res.error) showToast(res.error, false);
        else { showToast("已取消 " + count + " 堂,各自延伸 +7 天"); clearSelect(); }
      },
    });
  };

  const handleUndoSub = (lesson: Lesson) => {
    handleUndoSubConfirm(lesson);
  };

  const handleUndoSubConfirm = (lesson: Lesson) => {
    const cur = teacherById[lesson.teacher_id || ""]?.teacher_name || "—";
    const orig = teacherById[lesson.original_teacher_id || ""]?.teacher_name || "—";
    askConfirm({
      title: "撤銷代課",
      message: "確定要撤銷這筆代課紀錄?\n\n目前老師:" + cur + "\n原老師:" + orig + "\n\n撤銷後老師會還原成 " + orig + ",費用結構也會還原成原本設定。",
      confirmLabel: "確認撤銷",
      onConfirm: async () => {
        const res = await undoSubstitute(lesson.id);
        if (res.error) showToast(res.error, false);
        else { showToast("已撤銷代課"); closeModal(); }
      },
    });
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "today", label: `今日` },
    { key: "week", label: "本週" },
    { key: "overdue", label: overdueCount > 0 ? `逾期 (${overdueCount})` : "逾期" },
    { key: "all", label: "全部" },
  ];

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 頁首 */}
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>課程管理</h2>
      </div>

      <PageIntro storageKey="lessons" title="課程管理 · 說明">
        <p>每天上完課在這裡標記,標「完成」的才計入匯款結算與 Lee 收入。</p>
        <p>• <strong>完成</strong>:扣 1 堂並計入本期匯款。誤標可用「↺ 改回待上課」復原。</p>
        <p>• <strong>取消</strong>:自動在 +7 天建立延伸課,維持堂數守恆。也可直接指定補課日期。</p>
        <p>• <strong>代課</strong>:依新老師費率更新 payout,原費率保存可撤銷。</p>
        <p>• 逾期未標記的課不計匯款,建議每天結束前處理完。</p>
      </PageIntro>

      {/* 逾期 banner(今日/本週 tab 才顯示) */}
      {overdueCount > 0 && (tab === "today" || tab === "week") && (
        <div
          className="rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
          style={{ background: C.redSoft, border: `1px solid ${C.red}` }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: C.red }}>
              ⚠ 有 {overdueCount} 堂已過期課程尚未標記
            </div>
            <div className="text-xs mt-0.5" style={{ color: C.red }}>
              未標記的課不會計入匯款結算與 Lee 收入
            </div>
          </div>
          <Btn kind="danger" size="sm" onClick={() => setTab("overdue")}>
            前往處理
          </Btn>
        </div>
      )}

      {/* Filter tabs + 搜尋 */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); clearSelect(); if (t.key === 'today' || t.key === 'week' || t.key === 'all') setOnlyPending(true); }}
              className="px-3 py-2 text-xs font-medium transition-colors"
              style={{
                background: tab === t.key ? C.navy : C.card,
                color: tab === t.key ? "#fff" : t.key === "overdue" && overdueCount > 0 ? C.red : C.muted,
                borderRight: `1px solid ${C.line}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          className="rounded-lg border px-3 py-2 text-sm flex-1 min-w-32"
          style={{ borderColor: C.line, color: C.text, fontSize: 16 }}
          placeholder="搜尋學生 / 老師…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(tab === "today" || tab === "week" || tab === "all") && (
          <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: C.navy, fontWeight: onlyPending ? 500 : 400 }}>
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
            />
            只看待上
          </label>
        )}
        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: C.muted }}>
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />
          顯示已取消
        </label>
        <button
          onClick={handleExportCsv}
          className="text-xs px-3 py-2 rounded-lg"
          style={{ border: `1px solid ${C.line}`, color: C.muted }}
        >
          ⬇ CSV 匯出
        </button>
      </div>

      {/* 批次操作列 */}
      {selected.size > 0 && (
        <BatchBar
          count={selected.size}
          onComplete={handleBatchComplete}
          onCancel={handleBatchCancel}
          onClear={clearSelect}
          isPending={isPending}
        />
      )}

      {/* 課程列表 */}
      <Card
        title={`${TABS.find((t) => t.key === tab)?.label} · ${filtered.length} 堂`}
        right={
          filtered.length > 0 ? (
            <button
              className="text-xs"
              style={{ color: C.muted }}
              onClick={selected.size === filtered.length ? clearSelect : selectAll}
            >
              {selected.size === filtered.length ? "取消全選" : "全選"}
            </button>
          ) : null
        }
      >
        {filtered.length === 0 ? (
          <Empty>
            {tab === "today" ? "今天沒有排定的課程。" :
             tab === "week" ? "本週沒有排定的課程。" :
             tab === "overdue" ? "沒有逾期未處理的課程。棒！" :
             "沒有符合條件的課程。"}
          </Empty>
        ) : (
          <Table head={["", "日期", "時間", "學生", "老師", "類型", "時長", "狀態", "費用", "備註", "操作"]}>
            {filtered.map((l) => {
              const student = studentById[l.student_id];
              const teacher = teacherById[l.teacher_id || ""];
              const origTeacher = teacherById[l.original_teacher_id || ""];
              const snap = l.payout_snapshot || {} as PayoutSnapshot;
              const leeFee = effectiveLeeCommission(l);
              const isCompleted = l.status === "completed";
              const isCancelled = l.status === "cancelled";
              const isScheduled = l.status === "scheduled";

              return (
                <tr
                  key={l.id}
                  style={{
                    borderBottom: `1px solid ${C.line}`,
                    opacity: isCancelled ? 0.45 : 1,
                    background: selected.has(l.id) ? "#EAF0F6" : "transparent",
                  }}
                >
                  <Td>
                    {!isCancelled && (
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggleSelect(l.id)}
                      />
                    )}
                  </Td>
                  <Td>
                    <div className="text-sm font-medium" style={{ color: l.date < today && isScheduled ? C.red : C.text }}>
                      {l.date.slice(5).replace("-", "/")}
                    </div>
                    <div className="text-xs" style={{ color: C.muted }}>{l.date.slice(0,4)}</div>
                  </Td>
                  <Td>
                    <span className="text-sm" style={{ color: C.muted }}>{l.time || "—"}</span>
                  </Td>
                  <Td>
                    <div className="font-medium text-sm" style={{ color: C.navy }}>
                      {student?.zh_name || "—"}
                    </div>
                    {student?.en_name && (
                      <div className="text-xs" style={{ color: C.muted }}>{student.en_name}</div>
                    )}
                  </Td>
                  <Td>
                    <div className="text-sm" style={{ color: C.text }}>
                      {teacher?.teacher_name || "—"}
                    </div>
                    {l.is_substitute && origTeacher && (
                      <div className="text-xs" style={{ color: C.amber }}>
                        代:{origTeacher.teacher_name}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      <Badge tone={CLASS_TYPE_TONE[l.class_type] || "gray"}>
                        {CLASS_TYPE_LABEL[l.class_type] || l.class_type}
                      </Badge>
                      {l.is_substitute && (
                        <Badge tone="amber">代課</Badge>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs" style={{ color: C.muted }}>{l.duration ? l.duration + " 分" : "—"}</span>
                  </Td>
                  <Td>
                    <Badge
                      tone={isCompleted ? "green" : isCancelled ? "gray" : l.date < today ? "red" : "navy"}
                    >
                      {isCompleted ? "已完成" : isCancelled ? "已取消" : l.date < today ? "逾期" : "待上"}
                    </Badge>
                  </Td>
                  <Td>
                    {!isCancelled && (
                      <div className="text-xs" style={{ color: C.muted }}>
                        <div>師 {money(snap.teacher_payout_ntd)}</div>
                        <div style={{ color: C.green }}>Lee {money(leeFee)}</div>
                      </div>
                    )}
                  </Td>
                  <Td>
                    {editingNoteId === l.id ? (
                      <div className="flex gap-1 items-center">
                        <input
                          value={noteEdit}
                          onChange={(e) => setNoteEdit(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveNote(l.id);
                            if (e.key === "Escape") setEditingNoteId(null);
                          }}
                          className="px-2 py-1 text-xs rounded"
                          style={{ border: `1px solid ${C.line}`, minWidth: 100 }}
                          autoFocus
                        />
                        <button
                          onClick={() => saveNote(l.id)}
                          className="text-xs px-1.5 py-1 rounded"
                          style={{ background: C.green, color: "#fff" }}
                        >✓</button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="text-xs"
                          style={{ color: C.muted }}
                        >✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingNoteId(l.id); setNoteEdit(l.note || ""); }}
                        className="text-xs text-left"
                        style={{ color: l.note ? C.text : C.muted, minWidth: 60 }}
                      >
                        {l.note || "＋ 備註"}
                      </button>
                    )}
                  </Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {isScheduled && (
                        <>
                          <Btn kind="good" size="sm" disabled={isPending} onClick={() => handleComplete(l.id)}>
                            完成
                          </Btn>
                          <Btn
                            kind="ghost"
                            size="sm"
                            onClick={() => setModal({ kind: "cancel", lesson: l })}
                          >
                            取消
                          </Btn>
                          <Btn
                            kind="ghost"
                            size="sm"
                            onClick={() => {
                              const acc = accountById[l.account_id];
                              if (acc) setModal({ kind: "substitute", lessons: [l], account: acc });
                            }}
                          >
                            代課
                          </Btn>
                        </>
                      )}
                      {isCompleted && (
                        <Btn kind="ghost" size="sm" disabled={isPending} onClick={() => handleRevert(l.id)}>
                          ↺ 撤銷
                        </Btn>
                      )}
                      {l.is_substitute && !isCancelled && (
                        <Btn kind="ghost" size="sm" onClick={() => handleUndoSub(l)}>
                          撤銷代課
                        </Btn>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ── Modals ── */}
      {modal.kind === "cancel" && (
        <CancelModal
          lesson={modal.lesson}
          account={accountById[modal.lesson.account_id]}
          teachers={teachers}
          onDone={(msg) => { showToast(msg); closeModal(); }}
          onError={(msg) => showToast(msg, false)}
          onClose={closeModal}
        />
      )}
      {modal.kind === "substitute" && (
        <SubstituteModal
          lessons={modal.lessons}
          account={modal.account}
          teachers={teachers}
          priceRules={priceRules}
          phpRate={phpRate}
          onDone={(msg) => { showToast(msg); clearSelect(); closeModal(); }}
          onError={(msg) => showToast(msg, false)}
          onClose={closeModal}
        />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
