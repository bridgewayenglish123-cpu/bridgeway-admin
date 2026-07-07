"use client";

import { useState, useTransition, useMemo } from "react";
import { C } from "@/lib/constants";
import type {
  Account, Student, Teacher, Lesson, PriceRule,
  TeacherType, BillingType,
} from "@/lib/supabase/types";
import PageIntro from "@/components/ui/PageIntro";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import { money, todayYMD } from "@/lib/utils";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  openAccount,
  convertTrialToFull,
  closeAccount,
  reopenAccount,
  deleteAccount,
  bookFlexLesson,
  type OpenAccountInput,
} from "@/app/actions/accounts";

type PartialStudent = Pick<Student, "id" | "zh_name" | "en_name" | "current_teacher_id" | "status">;
type PartialTeacher = Pick<Teacher, "id" | "teacher_name" | "teacher_type" | "active_status">;
type PartialLesson = Pick<Lesson, "id" | "account_id" | "student_id" | "teacher_id" | "date" | "time" | "duration" | "status" | "is_active" | "class_type">;

interface Props {
  accounts: Account[];
  students: PartialStudent[];
  teachers: PartialTeacher[];
  lessons: PartialLesson[];
  priceRules: PriceRule[];
}

type ModalState =
  | { kind: "none" }
  | { kind: "open"; prefillStudentId?: string }
  | { kind: "flex"; account: Account };

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

function accountStatus(acc: Account, lessons: PartialLesson[]) {
  if (acc.status_override === "Closed") return "Closed";
  const completed = lessons.filter(
    (l) => l.account_id === acc.id && l.is_active && l.status === "completed"
  ).length;
  if (completed >= acc.total_lessons) return "Completed";
  if (acc.is_trial) return "Trial";
  return "Active";
}

const STATUS_LABEL: Record<string, string> = {
  Active: "進行中", Trial: "試聽中", Closed: "已結束", Completed: "已完課",
};
const STATUS_TONE: Record<string, "green" | "gold" | "gray" | "navy"> = {
  Active: "green", Trial: "gold", Closed: "gray", Completed: "navy",
};

// ── 開課表單 ──────────────────────────────────────────────────────────────────
function OpenAccountForm({
  students, teachers, priceRules, prefillStudentId,
  prefillRuleCode, prefillNote,
  onSave, onCancel, isPending,
}: {
  students: PartialStudent[];
  teachers: PartialTeacher[];
  priceRules: PriceRule[];
  prefillStudentId?: string;
  prefillRuleCode?: string;
  prefillNote?: string;
  onSave: (input: OpenAccountInput) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [studentId, setStudentId] = useState(prefillStudentId || "");
  const [ruleCode, setRuleCode] = useState(prefillRuleCode || "");
  const [courseLabel, setCourseLabel] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayYMD());
  const [note, setNote] = useState(prefillNote || "");
  const [manualLessons, setManualLessons] = useState("");

  const activeStudents = useMemo(() => students
    .filter((s) => s.status === "Active")
    .sort((a, b) => a.zh_name.localeCompare(b.zh_name, "zh-TW")),
  [students]);
  const selectedRule = priceRules.find((r) => r.price_rule_code === ruleCode);
  const lessonCount = selectedRule ? selectedRule.lesson_count : parseInt(manualLessons) || 0;
  const canSave = studentId && (ruleCode || (courseLabel && lessonCount > 0));

  const handleSave = () => {
    if (!canSave) return;
    const rule = selectedRule;
    const snapshot = rule
      ? {
          original_price_ntd: rule.price_ntd,
          lesson_count: rule.lesson_count,
          teacher_payout_ntd: rule.teacher_payout_ntd,
          hanne_share_ntd: rule.hanne_share_ntd,
          lee_commission_ntd: Math.round(rule.price_ntd / rule.lesson_count) - rule.teacher_payout_ntd - rule.hanne_share_ntd,
        }
      : { original_price_ntd: 0, lesson_count: lessonCount, teacher_payout_ntd: 0, hanne_share_ntd: 0, lee_commission_ntd: 0 };

    onSave({
      student_id: studentId,
      course_label: courseLabel || rule?.display_name || "",
      teacher_type: (rule?.teacher_type || "Other") as TeacherType,
      course_family: rule?.course_family || "General",
      duration_type: rule?.duration_type || "Short25",
      billing_type: (rule?.billing_type || "Package") as BillingType,
      total_lessons: lessonCount,
      is_trial: rule?.billing_type === "Trial" || false,
      price_rule_code: ruleCode,
      payment_date: paymentDate,
      note,
      snapshot,
    });
  };

  return (
    <div className="space-y-3">
              <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            學生 <span style={{ color: C.red }}>*</span>
          </label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="" disabled>選擇學生...</option>
            {activeStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.zh_name}{s.en_name ? ` (${s.en_name})` : ""}
              </option>
            ))}
          </select>
        </div>

      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>價格方案</label>
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={ruleCode}
          onChange={(e) => {
            setRuleCode(e.target.value);
            const r = priceRules.find((p) => p.price_rule_code === e.target.value);
            if (r && !courseLabel) setCourseLabel(r.display_name);
          }}
        >
          <option value="">⚙ 自訂方案(手動填寫)</option>
          {(() => {
            const orderMap: Record<string, number> = {
              "Hanne_Trial25": 1, "Hanne_Short25": 2, "Hanne_Long55": 3,
              "Other_Trial25": 4, "Other_Short25": 5, "Other_Long55": 6,
            };
            const sorted = [...priceRules].sort((a, b) => {
              const ka = a.teacher_type + "_" + a.duration_type;
              const kb = b.teacher_type + "_" + b.duration_type;
              const oa = orderMap[ka] || 99;
              const ob = orderMap[kb] || 99;
              if (oa !== ob) return oa - ob;
              return a.lesson_count - b.lesson_count;
            });
            const hanneRules = sorted.filter(r => r.teacher_type === "Hanne");
            const otherRules = sorted.filter(r => r.teacher_type !== "Hanne");
            return (
              <>
                {hanneRules.length > 0 && (
                  <optgroup label="Hanne 老師">
                    {hanneRules.map((r) => (
                      <option key={r.price_rule_code} value={r.price_rule_code}>
                        {r.display_name} · NT$ {money(r.price_ntd)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherRules.length > 0 && (
                  <optgroup label="其他老師">
                    {otherRules.map((r) => (
                      <option key={r.price_rule_code} value={r.price_rule_code}>
                        {r.display_name} · NT$ {money(r.price_ntd)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </>
            );
          })()}
        </select>
      </div>
      {selectedRule && (
        <div className="rounded-lg p-3 text-xs space-y-1.5" style={{ background: "#EAF0F6", color: C.navy }}>
          <div className="font-semibold mb-1" style={{ color: C.muted }}>凍結 snapshot 預覽</div>
          <div className="flex justify-between">
            <span>課程費用</span>
            <span className="font-medium">NT$ {money(selectedRule.price_ntd)}</span>
          </div>
          <div>
            <div className="flex justify-between">
              <span>老師薪資(總額)</span>
              <span>NT$ {money(selectedRule.teacher_payout_ntd * selectedRule.lesson_count)}</span>
            </div>
            <div style={{ color: C.muted }}>每堂 NT$ {money(selectedRule.teacher_payout_ntd)} × {selectedRule.lesson_count} 堂</div>
          </div>
          {selectedRule.hanne_share_ntd > 0 && (
            <div>
              <div className="flex justify-between">
                <span>Hanne 抽成(總額)</span>
                <span>NT$ {money(selectedRule.hanne_share_ntd * selectedRule.lesson_count)}</span>
              </div>
              <div style={{ color: C.muted }}>每堂 NT$ {money(selectedRule.hanne_share_ntd)} × {selectedRule.lesson_count} 堂</div>
            </div>
          )}
          <div className="flex justify-between font-medium pt-0.5" style={{ borderTop: `1px solid rgba(15,42,74,0.12)`, color: C.green }}>
            <span>Lee 收入(總額)</span>
            <span>NT$ {money(selectedRule.price_ntd - (selectedRule.teacher_payout_ntd * selectedRule.lesson_count) - (selectedRule.hanne_share_ntd * selectedRule.lesson_count))}</span>
          </div>
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
          課程標籤 <span style={{ color: C.red }}>*</span>
        </label>
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={courseLabel}
          onChange={(e) => setCourseLabel(e.target.value)}
          placeholder="e.g. 2024 春季 25分鐘 8堂"
        />
      </div>
      {!selectedRule && (
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
            堂數 <span style={{ color: C.red }}>*</span>
          </label>
          <input
            type="number" min={1}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={manualLessons}
            onChange={(e) => setManualLessons(e.target.value)}
            placeholder="e.g. 8"
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>收款日期</label>
        <input
          type="date"
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>備註</label>
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Btn kind="ghost" size="sm" onClick={onCancel} disabled={isPending}>取消</Btn>
        <Btn kind="primary" size="sm" disabled={!canSave || isPending} onClick={handleSave}>
          {isPending ? "開課中…" : "開課"}
        </Btn>
      </div>
    </div>
  );
}

// ── 彈性排課表單(修正版) ──────────────────────────────────────────────────────
function FlexLessonForm({
  account, teachers, lessons, onClose,
}: {
  account: Account;
  teachers: PartialTeacher[];
  lessons: PartialLesson[];
  onClose: () => void;
}) {
  const defaultDuration = account.duration_type === "Long55" ? 55 : 25;
  const [teacherId, setTeacherId] = useState("");
  const [date, setDate] = useState(todayYMD());
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(defaultDuration);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // 老師過濾:Hanne 帳戶只列 Hanne;Other 帳戶只列 Other
  const filteredTeachers = teachers.filter(
    (t) =>
      t.active_status === "Active" &&
      (account.teacher_type === "Hanne"
        ? t.teacher_type === "Hanne"
        : t.teacher_type === "Other")
  );

  const completed = lessons.filter(
    (l) => l.account_id === account.id && l.is_active && l.status === "completed"
  ).length;
  const generalScheduled = lessons.filter(
    (l) => l.account_id === account.id && l.is_active && l.class_type === "general"
  ).length;
  const remaining = account.total_lessons - completed;

  const canSubmit = teacherId && date && time && !isPending;

  const doSave = (keepOpen: boolean) => {
    startTransition(async () => {
      const res = await bookFlexLesson({
        account_id: account.id,
        student_id: account.student_id,
        teacher_id: teacherId,
        date,
        time,
        duration,
        total_lessons: account.total_lessons,
        snapshot: account.snapshot,
      });
      if (!res.ok) {
        setStatus({ ok: false, msg: res.error || "排課失敗" });
      } else if (keepOpen) {
        setStatus({ ok: true, msg: `已排:${date} ${time}` });
        setTime("");
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* 帳戶摘要 */}
      <div className="rounded-lg p-3 text-sm" style={{ background: "#EAF0F6", color: C.navy }}>
        <strong>{account.course_label}</strong>
        <span className="ml-2" style={{ color: C.muted }}>
          剩餘{" "}
          <span style={{ color: remaining > 0 ? C.green : C.red, fontWeight: 600 }}>
            {remaining}
          </span>
          {" "}/ {account.total_lessons} 堂
        </span>
      </div>

      {/* 狀態訊息(成功/失敗) */}
      {status && (
        <div
          className="rounded-lg p-3 text-sm whitespace-pre-line"
          style={{
            background: status.ok ? C.greenSoft : C.redSoft,
            color: status.ok ? C.green : C.red,
          }}
        >
          {status.ok ? "✅ " : "⚠ "}{status.msg}
        </div>
      )}

      {/* 老師 */}
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>老師</label>
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
        >
          <option value="">— 選擇老師 —</option>
          {[...filteredTeachers].sort((a,b) => a.teacher_name.localeCompare(b.teacher_name)).map((t) => (
            <option key={t.id} value={t.id}>{t.teacher_name}</option>
          ))}
        </select>
        {filteredTeachers.length === 0 && (
          <div className="text-xs mt-1" style={{ color: C.amber }}>
            此帳戶類型({account.teacher_type})目前沒有啟用中的老師。
          </div>
        )}
      </div>

      {/* 日期 + 時間 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>日期</label>
          <input
            type="date"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={date}
            onChange={(e) => { setDate(e.target.value); setStatus(null); }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>時間</label>
          <input
            type="time"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: C.line, color: C.text }}
            value={time}
            onChange={(e) => { setTime(e.target.value); setStatus(null); }}
          />
        </div>
      </div>

      {/* 時長 */}
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>時長</label>
        <div className="flex gap-4">
          {[25, 55].map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: C.text }}>
              <input type="radio" checked={duration === d} onChange={() => setDuration(d)} />
              {d} 分鐘
            </label>
          ))}
        </div>
      </div>

      {/* 三顆按鈕 */}
      <div className="flex justify-end gap-2 pt-1">
        <Btn kind="ghost" size="sm" onClick={onClose} disabled={isPending}>
          關閉
        </Btn>
        <Btn
          kind="ghost"
          size="sm"
          disabled={!canSubmit}
          onClick={() => doSave(true)}
        >
          {isPending ? "儲存中…" : "儲存並再排一堂"}
        </Btn>
        <Btn
          kind="gold"
          size="sm"
          disabled={!canSubmit}
          onClick={() => doSave(false)}
        >
          {isPending ? "儲存中…" : "儲存並關閉"}
        </Btn>
      </div>
    </div>
  );
}


// ── 展開列子元件(#14) ────────────────────────────────────────────────────────
function ExpandedRow({
  accId,
  lessons,
  teacherById,
}: {
  accId: string;
  lessons: PartialLesson[];
  teacherById: Record<string, PartialTeacher>;
}) {
  const accLessons = lessons
    .filter((l) => l.account_id === accId && l.is_active)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  return (
    <tr style={{ borderBottom: `1px solid ${C.line}`, background: "#FAFBFC" }}>
      <td colSpan={7} className="p-3">
        <div className="text-xs font-semibold mb-2" style={{ color: C.muted }}>
          課程明細({accLessons.length} 堂)
        </div>
        {accLessons.length === 0 ? (
          <div className="text-sm py-2" style={{ color: C.muted }}>
            此帳戶尚無課程紀錄。到「排課管理」設定規則,或點「排課」手動加。
          </div>
        ) : (
          <Table head={["日期", "時間", "老師", "類型", "狀態"]}>
            {accLessons.map((l) => (
              <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                <Td><span className="text-xs">{l.date}</span></Td>
                <Td><span className="text-xs" style={{ color: C.muted }}>{l.time || "—"}</span></Td>
                <Td><span className="text-xs">{teacherById[l.teacher_id || ""]?.teacher_name || "—"}</span></Td>
                <Td>
                  <Badge
                    tone={
                      l.class_type === "makeup" ? "amber" :
                      l.class_type === "extension" ? "navy" : "gray"
                    }
                  >
                    {l.class_type === "makeup" ? "補課" :
                     l.class_type === "extension" ? "延伸" : "一般"}
                  </Badge>
                </Td>
                <Td>
                  <Badge
                    tone={
                      l.status === "completed" ? "green" :
                      l.status === "cancelled" ? "red" : "gray"
                    }
                  >
                    {l.status === "completed" ? "已完成" :
                     l.status === "cancelled" ? "已取消" : "待上"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </td>
    </tr>
  );
}

// ── 主元件 ────────────────────────────────────────────────────────────────────
export default function AccountsClient({ accounts, students, teachers, lessons, priceRules }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filterStudent, setFilterStudent] = useState("");
  const [convertPrefill, setConvertPrefill] = useState<{
    studentId: string; ruleCode: string; note: string;
  } | null>(null);
  const [filterTab, setFilterTab] = useState<"active" | "closed" | "all">("active");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };
  const { askConfirm } = useConfirm();

  const closeModal = () => setModal({ kind: "none" });

  // #D1 試聽轉正:找建議方案並預填開課 Modal
  const convertTrialToFormal = (trialAccount: Account) => {
    const candidateRules = priceRules
      .filter((r) =>
        r.active_status === "Active" &&
        r.billing_type === "Package" &&
        r.teacher_type === trialAccount.teacher_type
      )
      .sort((a, b) => {
        if (a.duration_type === "Short25" && a.lesson_count === 8) return -1;
        if (b.duration_type === "Short25" && b.lesson_count === 8) return 1;
        if (a.duration_type !== b.duration_type)
          return a.duration_type === "Short25" ? -1 : 1;
        return a.lesson_count - b.lesson_count;
      });
    const suggested = candidateRules[0];
    if (!suggested) {
      showToast("找不到適合的正式方案,請先到「價格規則」新增", false);
      return;
    }
    setConvertPrefill({
      studentId: trialAccount.student_id,
      ruleCode: suggested.price_rule_code,
      note: `由試聽帳戶轉正式(${studentById[trialAccount.student_id]?.zh_name || ""})`,
    });
    setModal({ kind: "open" });
  };

  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t) => [t.id, t])), [teachers]);

  // #8 孤兒帳戶
  const orphanAccounts = useMemo(
    () => accounts.filter((a) => !studentById[a.student_id]),
    [accounts, studentById]
  );

  const handleCleanOrphans = () => {
    startTransition(async () => {
      const { cleanupOrphanAccounts } = await import("@/app/actions/accounts");
      const res = await cleanupOrphanAccounts({
        accountIds: orphanAccounts.map((a) => a.id),
        enrollmentIds: orphanAccounts.map((a) => a.enrollment_id).filter(Boolean) as string[],
      });
      if (res.error) showToast(res.error, false);
      else showToast(`已清理 ${res.deleted} 個孤兒帳戶`);
    });
  };

  const getCompleted = (accId: string) =>
    lessons.filter((l) => l.account_id === accId && l.is_active && l.status === "completed").length;
  const getRemaining = (acc: Account) => acc.total_lessons - getCompleted(acc.id);
  const getStatus = (acc: Account) => accountStatus(acc, lessons);

  const filtered = useMemo(() => {
    let list = accounts;
    if (filterStudent) list = list.filter((a) => a.student_id === filterStudent);
    if (filterTab === "active") {
      list = list.filter((a) => {
        const s = getStatus(a);
        return s === "Active" || s === "Trial";
      });
    } else if (filterTab === "closed") {
      list = list.filter((a) => {
        const s = getStatus(a);
        return s === "Closed" || s === "Completed";
      });
    }
    return list;
  }, [accounts, filterStudent, filterTab]);

  const handleOpenAccount = (input: OpenAccountInput) => {
    startTransition(async () => {
      const res = await openAccount(input);
      if (res.error) showToast(res.error, false);
      else { showToast("課程帳戶已開立"); closeModal(); }
    });
  };

  const handleClose = (acc: Account) => {
    const student = studentById[acc.student_id];
    const remaining = getRemaining(acc);
    const upcoming = lessons.filter((l) => l.account_id === acc.id && l.is_active && l.status === "scheduled").length;
    askConfirm({
      title: "結束帳戶",
      message: `即將結束「${student?.zh_name || "?"} - ${acc.course_label}」帳戶。

目前剩餘 ${remaining} 堂 / ${upcoming} 堂待上課程。

結束後帳戶會歸類到「已結束」tab,已排定的課程不會自動取消(需另外處理),排課規則需另外停用。`,
      confirmLabel: "確認結束",
      onConfirm: async () => {
        const res = await closeAccount(acc.id);
        if (res.error) showToast(res.error, false);
        else { showToast(`${acc.course_label} 已結束`); closeModal(); }
      },
    });
  };

  const handleReopen = (acc: Account) => {
    const student = studentById[acc.student_id];
    askConfirm({
      title: "重啟帳戶",
      message: `即將重啟「${student?.zh_name || "?"} - ${acc.course_label}」帳戶。

帳戶會回到「進行中」tab,可以繼續排課和上課。`,
      confirmLabel: "確認重啟",
      onConfirm: async () => {
        const res = await reopenAccount(acc.id);
        if (res.error) showToast(res.error, false);
        else { showToast(`${acc.course_label} 已重新啟用`); closeModal(); }
      },
    });
  };

  const handleDelete = (acc: Account) => {
    const student = studentById[acc.student_id];
    const accLessons = lessons.filter((l) => l.account_id === acc.id && l.is_active);
    const completedCount = accLessons.filter((l) => l.status === "completed").length;
    const ruleCount = 0; // schedule_rules 在 accounts 頁沒有載入,顯示 0 或不顯示
    askConfirm({
      title: "刪除帳戶(連鎖刪除)",
      message: `即將刪除「${student?.zh_name || "?"} - ${acc.course_label}」帳戶。

連帶會刪除:
· ${accLessons.length} 堂課程紀錄(含 ${completedCount} 堂已完成)
· 對應的開課紀錄(enrollment)

此動作不可復原,且會影響匯款統計。`,
      confirmLabel: "確認完全刪除",
      danger: true,
      onConfirm: async () => {
        const res = await deleteAccount(acc.id);
        if (res.error) showToast(res.error, false);
        else { showToast(`${acc.course_label} 已刪除`); closeModal(); }
      },
    });
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 頁首 */}
      <div className="pb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
          Bridgeway English · Admin
        </div>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy }}>學員課程</h2>
          <Btn kind="gold" size="md" onClick={() => setModal({ kind: "open" })}>+ 開新課程</Btn>
        </div>
      </div>

      <PageIntro storageKey="accounts" title="學員課程 · 說明">
        <p>管理每位學生的課程帳戶(開課紀錄)。</p>
        <p>• <strong>開課</strong>:選擇學生 + 價格方案,系統自動帶入 snapshot 金額。</p>
        <p>• <strong>試聽轉正</strong>:點「轉正式」,舊試聽帳戶自動關閉,開立新正式帳戶。</p>
        <p>• <strong>彈性排課</strong>:直接排定一堂課,「儲存並再排一堂」可連排不關 Modal。</p>
        <p>• <strong>刪除</strong>:會一併刪除所有關聯課程紀錄與排課規則,謹慎操作。</p>
      </PageIntro>

      {/* #8 孤兒帳戶警示 */}
      {orphanAccounts.length > 0 && (
        <div className="rounded-xl p-3 flex items-center gap-3 flex-wrap"
          style={{ background: "#FEE2E2", border: "1px solid #FCA5A5" }}>
          <span className="text-sm font-medium flex-1" style={{ color: "#B91C1C" }}>
            ⚠ 發現 {orphanAccounts.length} 個帳戶的學生資料不見了(學生欄顯示「—」的原因)
          </span>
          <Btn kind="danger" size="sm" disabled={isPending} onClick={handleCleanOrphans}>
            {isPending ? "清理中…" : "一鍵清理"}
          </Btn>
        </div>
      )}

      {/* #9 Filter tab + 學生篩選 */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {([["active","進行中"],["closed","已結束"],["all","全部"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setFilterTab(v)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: filterTab === v ? C.navy : C.card,
                color: filterTab === v ? "#fff" : C.muted,
                borderRight: `1px solid ${C.line}`,
              }}>
              {label}
            </button>
          ))}
        </div>
        <select className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: C.line, color: C.text }}
          value={filterStudent}
          onChange={(e) => setFilterStudent(e.target.value)}>
          <option value="">全部學生</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.zh_name}</option>
          ))}
        </select>
      </div>

      {/* 列表 */}
      <Card title={`課程帳戶(${filtered.length}${filtered.length !== accounts.length ? ` / ${accounts.length}` : ""})`}>
        {filtered.length === 0 ? (
          <Empty action={<Btn kind="gold" onClick={() => setModal({ kind: "open" })}>+ 開新課程</Btn>}>
            {accounts.length === 0 ? "還沒有任何課程帳戶。點右上角開課。" : "沒有符合條件的帳戶。"}
          </Empty>
        ) : (
          <Table head={["", "學生", "課程", "狀態", "進度", "剩餘", "操作"]}>
            {filtered.map((acc) => {
              const st = getStatus(acc);
              const student = studentById[acc.student_id];
              const completed = getCompleted(acc.id);
              const remaining = acc.total_lessons - completed;
              const pct = acc.total_lessons > 0
                ? Math.min(100, Math.round((completed / acc.total_lessons) * 100))
                : 0;

              return (
                <>
                <tr key={acc.id} style={{ borderBottom: expandedIds.has(acc.id) ? "none" : `1px solid ${C.line}`, opacity: st === "Closed" ? 0.55 : 1 }}>
                  <Td>
                    <button
                      onClick={() => toggleExpand(acc.id)}
                      className="text-xs w-5 h-5 flex items-center justify-center rounded"
                      style={{ color: C.muted, background: "#EAF0F6" }}
                    >
                      {expandedIds.has(acc.id) ? "▼" : "▶"}
                    </button>
                  </Td>
                  <Td>
                    <div className="font-medium" style={{ color: C.navy }}>{student?.zh_name || "—"}</div>
                    {student?.en_name && <div className="text-xs" style={{ color: C.muted }}>{student.en_name}</div>}
                  </Td>
                  <Td>
                    <div className="text-sm" style={{ color: C.text }}>{acc.course_label}</div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                      {acc.duration_type === "Long55" ? "55分鐘" : acc.is_trial ? "試聽25分" : "25分鐘"}
                      {" · "}NT$ {money(acc.snapshot?.original_price_ntd || 0)}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[st] || "gray"}>{STATUS_LABEL[st] || st}</Badge>
                  </Td>
                  <Td>
                    <div className="text-xs mb-1" style={{ color: C.muted }}>{completed}/{acc.total_lessons} 堂</div>
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: st === "Completed" ? C.green : C.gold }}
                      />
                    </div>
                  </Td>
                  <Td>
                    <span className="text-sm font-medium" style={{ color: remaining > 0 ? C.navy : C.muted }}>
                      {remaining > 0 ? `${remaining} 堂` : "—"}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {st === "Trial" && getCompleted(acc.id) >= 1 && (
                        <Btn kind="gold" size="sm" onClick={() => convertTrialToFormal(acc)}>
                          轉正式
                        </Btn>
                      )}
                      {(st === "Active" || st === "Trial") && (
                        <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "flex", account: acc })}>
                          排課
                        </Btn>
                      )}
                      {st === "Active" && (
                        <Btn kind="ghost" size="sm" onClick={() => handleClose(acc)}>
                          結束
                        </Btn>
                      )}
                      {st === "Closed" && (
                        <Btn kind="ghost" size="sm" onClick={() => handleReopen(acc)}>
                          重啟
                        </Btn>
                      )}
                      <Btn kind="danger" size="sm" onClick={() => handleDelete(acc)}>
                        刪除
                      </Btn>
                    </div>
                  </Td>
                </tr>
                {expandedIds.has(acc.id) && (
                  <ExpandedRow
                    key={acc.id + "_exp"}
                    accId={acc.id}
                    lessons={lessons}
                    teacherById={teacherById}
                  />
                )}
              </>
              );
            })}
          </Table>
        )}
      </Card>

      {/* ── Modals ── */}
      {modal.kind === "open" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) { closeModal(); setConvertPrefill(null); } }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 md:p-6 space-y-4 overflow-y-auto"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "92vh" }}
          >
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              {convertPrefill ? "試聽轉正式" : "開新課程"}
            </h3>
            <OpenAccountForm
              students={students}
              teachers={teachers}
              priceRules={priceRules}
              prefillStudentId={convertPrefill?.studentId || modal.prefillStudentId}
              prefillRuleCode={convertPrefill?.ruleCode}
              prefillNote={convertPrefill?.note}
              onSave={(input) => {
                setConvertPrefill(null);
                handleOpenAccount(input);
              }}
              onCancel={() => { closeModal(); setConvertPrefill(null); }}
              isPending={isPending}
            />
          </div>
        </div>
      )}

      {modal.kind === "flex" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 md:p-6 space-y-4"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "92vh", overflowY: "auto" }}
          >
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>彈性排課</h3>
            <FlexLessonForm
              account={modal.account}
              teachers={teachers}
              lessons={lessons}
              onClose={closeModal}
            />
          </div>
        </div>
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
