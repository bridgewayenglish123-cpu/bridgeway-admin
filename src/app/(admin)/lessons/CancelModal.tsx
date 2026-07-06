"use client";

import { useState, useTransition } from "react";
import { C } from "@/lib/constants";
import { todayYMD, addDays } from "@/lib/utils";
import type { Lesson } from "@/lib/supabase/types";
import Btn from "@/components/ui/Btn";
import { cancelLesson } from "@/app/actions/lessons";

interface Props {
  lesson: Lesson;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onClose: () => void;
}

export default function CancelModal({ lesson, onDone, onError, onClose }: Props) {
  const [step, setStep] = useState<"confirm" | "makeup">("confirm");
  const [makeupDate, setMakeupDate] = useState(addDays(lesson.date, 7));
  const [makeupTime, setMakeupTime] = useState(lesson.time || "");
  const [isPending, startTransition] = useTransition();

  const autoExtDate = addDays(lesson.date, 7);

  const handleCancelOnly = () => {
    startTransition(async () => {
      const res = await cancelLesson(lesson.id, null);
      if (res.error) onError(res.error);
      else onDone(`已取消,延伸課自動排到 ${autoExtDate}`);
    });
  };

  const handleCancelWithMakeup = () => {
    if (!makeupDate || !makeupTime) return;
    startTransition(async () => {
      const res = await cancelLesson(lesson.id, { date: makeupDate, time: makeupTime });
      if (res.error) onError(res.error);
      else onDone(`已取消,補課排到 ${makeupDate} ${makeupTime}`);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: "white", boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}
      >
        {step === "confirm" && (
          <>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              取消這堂課？
            </h3>
            <div className="text-sm space-y-1" style={{ color: C.text }}>
              <div>{lesson.date} {lesson.time}</div>
            </div>
            <div className="rounded-lg p-3 text-sm" style={{ background: "#EAF0F6", color: C.navy }}>
              取消後系統會自動在{" "}
              <strong>{autoExtDate}</strong> 同時間建立延伸課,堂數守恆。
            </div>
            <div className="text-sm font-medium" style={{ color: C.navy }}>
              要另外指定補課日期嗎？
            </div>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={onClose}>關閉</Btn>
              <Btn kind="ghost" size="sm" disabled={isPending} onClick={handleCancelOnly}>
                {isPending ? "處理中…" : "不用,自動延伸就好"}
              </Btn>
              <Btn kind="gold" size="sm" onClick={() => setStep("makeup")}>
                指定補課日期
              </Btn>
            </div>
          </>
        )}

        {step === "makeup" && (
          <>
            <h3 className="text-base font-semibold" style={{ color: C.navy }}>
              指定補課日期
            </h3>
            <div className="text-sm" style={{ color: C.muted }}>
              原課:{lesson.date} {lesson.time}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>補課日期</label>
                <input
                  type="date"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: C.line, color: C.text }}
                  value={makeupDate}
                  min={todayYMD()}
                  onChange={(e) => setMakeupDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>補課時間</label>
                <input
                  type="time"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: C.line, color: C.text }}
                  value={makeupTime}
                  onChange={(e) => setMakeupTime(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-lg p-3 text-xs" style={{ background: C.amberSoft, color: C.amber }}>
              補課建立後,原自動延伸課會被停用(堂數守恆)。
            </div>
            <div className="flex justify-end gap-2">
              <Btn kind="ghost" size="sm" onClick={() => setStep("confirm")}>← 返回</Btn>
              <Btn
                kind="primary"
                size="sm"
                disabled={!makeupDate || !makeupTime || isPending}
                onClick={handleCancelWithMakeup}
              >
                {isPending ? "處理中…" : "確認取消並建立補課"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
