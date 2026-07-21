"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/constants";
import Btn from "@/components/ui/Btn";
import UploadReportModal from "./lessons/UploadReportModal";

export interface PendingReportItem {
  lessonId: string;
  date: string;
  studentName: string;
  teacherName: string;
}

export interface TeacherUploadStat {
  teacherName: string;
  uploaded: number;
  total: number;
}

export default function PendingReports({
  pending,
  teacherStats,
}: {
  pending: PendingReportItem[];
  teacherStats: TeacherUploadStat[];
}) {
  const router = useRouter();
  const [active, setActive] = useState<PendingReportItem | null>(null);
  const SHOW_MAX = 5;
  const visible = pending.slice(0, SHOW_MAX);
  const extra = pending.length - SHOW_MAX;

  return (
    <div className="space-y-4">
      {/* 老師上傳狀況 */}
      {teacherStats.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold mb-3" style={{ color: C.navy }}>
            本週老師上傳狀況
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {teacherStats.map((t) => {
              const pct = t.total === 0 ? 100 : Math.round((t.uploaded / t.total) * 100);
              const allDone = t.uploaded === t.total;
              return (
                <div key={t.teacherName} className="rounded-lg p-3"
                  style={{ background: allDone ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${allDone ? '#BBF7D0' : '#FDE68A'}` }}>
                  <div className="text-[13px] font-semibold" style={{ color: C.navy }}>{t.teacherName}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                    {t.uploaded}/{t.total} 已上傳
                  </div>
                  {/* 進度條 */}
                  <div className="mt-2 h-1.5 rounded-full" style={{ background: C.line }}>
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${pct}%`, background: allDone ? '#22C55E' : '#F59E0B' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 近48小時未上傳 */}
      {pending.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#FFFBEB', border: `1px solid #FDE68A` }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold" style={{ color: '#92400E' }}>
              近 48 小時未上傳（{pending.length} 堂）
            </div>
            {extra > 0 && (
              <a href="/reports" className="text-xs underline" style={{ color: C.muted }}>
                查看全部
              </a>
            )}
          </div>
          <div className="space-y-1.5">
            {visible.map((p) => (
              <div key={p.lessonId}
                className="flex items-center gap-2 flex-wrap rounded-lg px-3 py-2"
                style={{ background: C.card }}>
                <span className="text-sm" style={{ color: C.navy }}>{p.date}</span>
                <span className="text-xs" style={{ color: C.muted }}>·</span>
                <span className="text-sm font-medium" style={{ color: C.navy }}>{p.studentName}</span>
                <span className="text-xs" style={{ color: C.muted }}>·</span>
                <span className="text-sm" style={{ color: C.text }}>{p.teacherName}</span>
                <div className="ml-auto">
                  <Btn kind="gold" size="sm" onClick={() => setActive(p)}>上傳</Btn>
                </div>
              </div>
            ))}
            {extra > 0 && (
              <div className="text-center text-[12px] pt-1" style={{ color: C.muted }}>
                +{extra} 筆 — <a href="/reports" className="underline">前往報告管理頁查看</a>
              </div>
            )}
          </div>
        </div>
      )}

      {active && (
        <UploadReportModal
          lessonId={active.lessonId}
          studentName={active.studentName}
          lessonDate={active.date}
          teacherName={active.teacherName}
          onGenerated={() => router.refresh()}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
