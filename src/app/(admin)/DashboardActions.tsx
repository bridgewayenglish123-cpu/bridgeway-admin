"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/constants";
import type { Lesson, Student, Teacher } from "@/lib/supabase/types";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import Empty from "@/components/ui/Empty";
import { markLessonCompleted, markLessonsCompleted } from "@/app/actions/lessons";

interface Props {
  todayFull: Lesson[];
  studentById: Record<string, Student>;
  teacherById: Record<string, Teacher>;
  today: string;
}

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

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isPending,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: C.card, boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}
      >
        <h3 className="text-base font-semibold" style={{ color: C.navy }}>{title}</h3>
        <p className="text-sm" style={{ color: C.text }}>{message}</p>
        <div className="flex justify-end gap-2">
          <Btn kind="ghost" size="sm" onClick={onCancel} disabled={isPending}>取消</Btn>
          <Btn kind="good" size="sm" disabled={isPending} onClick={onConfirm}>
            {isPending ? "處理中…" : confirmLabel}
          </Btn>
        </div>
      </div>
    </div>
  );
}

const CLASS_TYPE_LABEL: Record<string, string> = {
  general: "一般", makeup: "補課", extension: "延伸",
};
const CLASS_TYPE_TONE: Record<string, "gray" | "amber" | "navy"> = {
  general: "gray", makeup: "amber", extension: "navy",
};

export default function DashboardActions({ todayFull, studentById, teacherById, today }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localStatus, setLocalStatus] = useState<Record<string, "completed" | "cancelled">>({});

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const getStatus = (l: Lesson) => localStatus[l.id] || l.status;

  const scheduledToday = todayFull.filter((l) => getStatus(l) === "scheduled");

  const handleComplete = (lessonId: string) => {
    startTransition(async () => {
      const res = await markLessonCompleted(lessonId);
      if (res.error) showToast(res.error, false);
      else {
        setLocalStatus((prev) => ({ ...prev, [lessonId]: "completed" }));
        showToast("已標記完成");
      }
    });
  };

  const handleAllComplete = () => {
    setShowConfirm(true);
  };

  const confirmAllComplete = () => {
    const ids = scheduledToday.map((l) => l.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await markLessonsCompleted(ids);
      if (res.error) showToast(res.error, false);
      else {
        const next: Record<string, "completed"> = {};
        ids.forEach((id) => { next[id] = "completed"; });
        setLocalStatus((prev) => ({ ...prev, ...next }));
        showToast(`已標記 ${ids.length} 堂完成`);
        setShowConfirm(false);
      }
    });
  };

  return (
    <>
      <Card
        title={`今日課程(${today})`}
        right={
          <div className="flex gap-2">
            {scheduledToday.length > 0 && (
              <Btn size="sm" kind="good" onClick={handleAllComplete} disabled={isPending}>
                全部標記完成
              </Btn>
            )}
            <Btn size="sm" kind="ghost" onClick={() => router.push("/lessons")}>
              前往完整管理
            </Btn>
          </div>
        }
      >
        {todayFull.length === 0 ? (
          <Empty>今天沒有排定的課程。可以到「課程管理」看看本週安排。</Empty>
        ) : (
          <Table head={["時間", "學生", "老師", "類型", "狀態", "動作"]}>
            {todayFull.map((l) => {
              const status = getStatus(l);
              const isScheduled = status === "scheduled";
              return (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <Td>{l.time || "—"}</Td>
                  <Td>
                    <span className="font-medium" style={{ color: C.navy }}>
                      {studentById[l.student_id]?.zh_name || "—"}
                    </span>
                  </Td>
                  <Td>{teacherById[l.teacher_id || ""]?.teacher_name || "—"}</Td>
                  <Td>
                    <Badge tone={CLASS_TYPE_TONE[l.class_type] || "gray"}>
                      {CLASS_TYPE_LABEL[l.class_type] || l.class_type}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        status === "completed" ? "green" :
                        status === "cancelled" ? "red" : "gray"
                      }
                    >
                      {status === "completed" ? "已完成" :
                       status === "cancelled" ? "已取消" : "待上"}
                    </Badge>
                  </Td>
                  <Td>
                    {isScheduled ? (
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <Btn
                          size="sm"
                          kind="good"
                          disabled={isPending}
                          onClick={() => handleComplete(l.id)}
                        >
                          完成
                        </Btn>
                        <Btn
                          size="sm"
                          kind="ghost"
                          onClick={() => router.push("/lessons")}
                        >
                          其他
                        </Btn>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {showConfirm && (
        <ConfirmDialog
          title="一鍵標記今日全部完成"
          message={`將 ${scheduledToday.length} 堂今日「待上課」課程標記為已完成。取消的課不受影響。確定?`}
          confirmLabel="全部標記完成"
          onConfirm={confirmAllComplete}
          onCancel={() => setShowConfirm(false)}
          isPending={isPending}
        />
      )}

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  );
}
