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

export default function PendingReports({ pending }: { pending: PendingReportItem[] }) {
  const router = useRouter();
  const [active, setActive] = useState<PendingReportItem | null>(null);

  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: C.amberSoft, border: `1px solid ${C.amber}` }}>
      <div className="text-sm font-semibold mb-2" style={{ color: C.amber }}>
        尚未上傳報告的課堂
      </div>

      <div className="space-y-1.5">
        {pending.map((p) => (
          <div
            key={p.lessonId}
            className="flex items-center gap-2 flex-wrap rounded-lg px-3 py-2"
            style={{ background: C.card }}
          >
            <span className="text-sm" style={{ color: C.navy }}>{p.date}</span>
            <span className="text-xs" style={{ color: C.muted }}>·</span>
            <span className="text-sm font-medium" style={{ color: C.navy }}>{p.studentName}</span>
            <span className="text-xs" style={{ color: C.muted }}>·</span>
            <span className="text-sm" style={{ color: C.text }}>{p.teacherName} 老師</span>
            <div className="ml-auto">
              <Btn kind="gold" size="sm" onClick={() => setActive(p)}>
                上傳報告
              </Btn>
            </div>
          </div>
        ))}
      </div>

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
