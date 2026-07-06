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
  | { kind: "convert"; account: Account }
  | { kind: "flex"; account: Account }
  | { kind: "confirm-close"; account: Account }
  | { kind: "confirm-reopen"; account: Account }
  | { kind: "confirm-delete"; account: Account };

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
  onSave, onCancel, isPending, isConvert,
}: {
  students: PartialStudent[];
  teachers: PartialTeacher[];
  priceRules: PriceRule[];
  prefillStudentId?: string;
  onSave: (input: OpenAccountInput) => void;
  onCancel: () => void;
  isPending: boolean;
  isConvert?: boolean;
}) {
  const [studentId, setStudentId] = useState(prefillStudentId || "");
  const [ruleCode, setRuleCode] = useState("");
  const [courseLabel, setCourseLabel] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayYMD());
  const [note, setNote] = useState("");
  const [manualLessons, setManualLessons] = useState("");

  const activeStudents = students.filter((s) => s.status === "Active" || s.status === "Paused");
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
          lee_commission_ntd: rule.price_ntd - rule.teacher_payout_ntd - rule.hanne_share_ntd,
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
      {!isConvert && (
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
            <option value="">— 選擇學生 —</option>
            {activeStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.zh_name}{s.en_name ? ` (${s.en_name})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
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
          <option value="">— 手動輸入 —</option>
          {priceRules.map((r) => (
            <option key={r.price_rule_code} value={r.price_rule_code}>
              {r.display_name} · {r.lesson_count}堂 · NT${money(r.price_ntd)}
            </option>
          ))}
        </select>
      </div>
      {selectedRule && (
        <div className="rounded-lg p-3 text-xs space-y-1" style={{ background: "#EAF0F6", color: C.navy }}>
          <div className="flex justify-between"><span>課程費用</span><span className="font-medium">NT$ {money(selectedRule.price_ntd)}</span></div>
          <div className="flex justify-between"><span>老師薪資</span><span>NT$ {money(selectedRule.teacher_payout_ntd)}</span></div>
          <div className="flex justify-between"><span>Hanne 抽成</span><span>NT$ {money(selectedRule.hanne_share_ntd)}</span></div>
          <div className="flex justify-between font-medium" style={{ color: C.green }}>
            <span>Lee 收入</span>
            <span>NT$ {money(selectedRule.price_ntd - selectedRule.teacher_payout_ntd - selectedRule.hanne_share_ntd)}</span>
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
          {isPending ? "開課中…" : isConvert ? "轉為正式課程" : "開課"}
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
          {filteredTeachers.map((t) => (
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

// ── 主元件 ────────────────────────────────────────────────────────────────────
export default function AccountsClient({ accounts, students, teachers, lessons, priceRules }: Props) {
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filterStudent, setFilterStudent] = useState("");
  const [filterTab, setFilterTab] = useState<"active" | "closed" | "all">("active");
  

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };
  const closeModal = () => setModal({ kind: "none" });

  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));

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

  const handleConvert = (acc: Account, input: OpenAccountInput) => {
    startTransition(async () => {
      const res = await convertTrialToFull(acc.id, input);
      if (res.error) showToast(res.error, false);
      else { showToast("已轉為正式課程並關閉試聽帳戶"); closeModal(); }
    });
  };

  const handleClose = (acc: Account) => {
    startTransition(async () => {
      const res = await closeAccount(acc.id);
      if (res.error) showToast(res.error, false);
      else { showToast(`${acc.course_label} 已結束`); closeModal(); }
    });
  };

  const handleReopen = (acc: Account) => {
    startTransition(async () => {
      const res = await reopenAccount(acc.id);
      if (res.error) showToast(res.error, false);
      else { showToast(`${acc.course_label} 已重新啟用`); closeModal(); }
    });
  };

  const handleDelete = (acc: Account) => {
    startTransition(async () => {
      const res = await deleteAccount(acc.id);
      if (res.error) showToast(res.error, false);
      else { showToast(`${acc.course_label} 已刪除`); closeModal(); }
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
          <Table head={["學生", "課程", "狀態", "進度", "剩餘", "操作"]}>
            {filtered.map((acc) => {
              const st = getStatus(acc);
              const student = studentById[acc.student_id];
              const completed = getCompleted(acc.id);
              const remaining = acc.total_lessons - completed;
              const pct = acc.total_lessons > 0
                ? Math.min(100, Math.round((completed / acc.total_lessons) * 100))
                : 0;

              return (
                <tr key={acc.id} style={{ borderBottom: `1px solid ${C.line}`, opacity: st === "Closed" ? 0.55 : 1 }}>
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
                        <Btn kind="gold" size="sm" onClick={() => setModal({ kind: "convert", account: acc })}>
                          轉正式
                        </Btn>
                      )}
                      {(st === "Active" || st === "Trial") && (
                        <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "flex", account: acc })}>
                          排課
                        </Btn>
                      )}
                      {st === "Active" && (
                        <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "confirm-close", account: acc })}>
                          結束
                        </Btn>
                      )}
                      {st === "Closed" && (
                        <Btn kind="ghost" size="sm" onClick={() => setModal({ kind: "confirm-reopen", account: acc })}>
                          重啟
                        </Btn>
                      )}
                      <Btn kind="danger" size="sm" onClick={() => setModal({ kind: "confirm-delete", account: acc })}>
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
      {(modal.kind === "open" || modal.kind === "convert") && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 md:p-6 space-y-4 overflow-y-auto"
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)", maxHeight: "92vh" }}
          >
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              {modal.kind === "convert" ? `試聽轉正式 · ${modal.account.course_label}` : "開新課程"}
            </h3>
            <OpenAccountForm
              students={students}
              teachers={teachers}
              priceRules={priceRules}
              prefillStudentId={modal.kind === "convert" ? modal.account.student_id : modal.prefillStudentId}
              onSave={(input) => {
                if (modal.kind === "convert") handleConvert(modal.account, input);
                else handleOpenAccount(input);
              }}
              onCancel={closeModal}
              isPending={isPending}
              isConvert={modal.kind === "convert"}
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
            style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}
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

      {modal.kind === "confirm-close" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>結束課程帳戶？</h3>
            <p className="text-sm" style={{ color: C.text }}>
              「{modal.account.course_label}」將標記為已結束,未來可重新啟用。
            </p>
            {getRemaining(modal.account) > 0 && (
              <div className="rounded-lg p-3 text-sm" style={{ background: C.amberSoft, color: C.amber }}>
                ⚠ 此帳戶還有 <strong>{getRemaining(modal.account)}</strong> 堂未完成。
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="danger" size="sm" disabled={isPending} onClick={() => handleClose(modal.account)}>
                {isPending ? "處理中…" : "確認結束"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {modal.kind === "confirm-reopen" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm rounded-2xl p-5 space-y-4" style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>重新啟用帳戶？</h3>
            <p className="text-sm" style={{ color: C.text }}>「{modal.account.course_label}」將重新標記為進行中。</p>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="good" size="sm" disabled={isPending} onClick={() => handleReopen(modal.account)}>
                {isPending ? "處理中…" : "確認重啟"}
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
            <h3 className="text-base font-semibold" style={{ color: C.red }}>永久刪除課程帳戶？</h3>
            <div className="rounded-lg p-3 text-sm" style={{ background: C.redSoft, color: C.red }}>
              ⛔ 此操作將刪除「{modal.account.course_label}」及所有關聯課程紀錄與排課規則,無法復原。
            </div>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={closeModal}>取消</Btn>
              <Btn kind="danger" size="sm" disabled={isPending} onClick={() => handleDelete(modal.account)}>
                {isPending ? "刪除中…" : "永久刪除"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </div>
  );
}
