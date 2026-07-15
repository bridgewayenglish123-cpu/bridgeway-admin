"use client";

import { useState } from "react";
import { C } from "@/lib/constants";
import Btn from "@/components/ui/Btn";

interface Props {
  lessonId: string;
  studentName: string;
  lessonDate: string;
  teacherName: string;
  existingReportId?: string;
  onGenerated: () => void;
  onClose: () => void;
}

type Status = "idle" | "uploading" | "analyzing" | "done" | "error";

export default function UploadReportModal({
  lessonId,
  studentName,
  lessonDate,
  teacherName,
  existingReportId,
  onGenerated,
  onClose,
}: Props) {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isRegenerate = !!existingReportId;
  const busy = status === "uploading" || status === "analyzing";

  const handleSubmit = async () => {
    if (!file) return;
    setErrorMsg(null);
    try {
      setStatus("uploading");
      const vttContent = await file.text();

      setStatus("analyzing");
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          vttContent,
          teacherNote: note.trim() || undefined,
          existingReportId,
        }),
      });

      if (res.ok) {
        setStatus("done");
        onGenerated();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(typeof data?.error === "string" ? data.error : null);
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,30,54,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4 overflow-y-auto"
        style={{ background: "white", boxShadow: "0 8px 32px rgba(15,42,74,0.18)" }}
      >
        <h3 className="text-base font-semibold" style={{ color: C.navy }}>
          {isRegenerate ? "重新生成 AI 學習報告" : "生成 AI 學習報告"}
        </h3>

        {isRegenerate && (
          <div
            className="rounded-lg p-3 text-xs"
            style={{ background: C.amberSoft, color: C.amber }}
          >
            重新生成將覆蓋現有報告。
          </div>
        )}

        {/* 課堂資訊（唯讀） */}
        <div
          className="rounded-lg px-3 py-2.5 text-sm space-y-0.5"
          style={{ background: "#EAF0F6", color: C.navy }}
        >
          <div>
            <span style={{ color: C.muted }}>學生：</span>
            {studentName}
          </div>
          <div>
            <span style={{ color: C.muted }}>日期：</span>
            {lessonDate}
          </div>
          <div>
            <span style={{ color: C.muted }}>老師：</span>
            {teacherName}
          </div>
        </div>

        {status === "done" ? (
          <>
            <div
              className="rounded-lg p-3 text-sm"
              style={{ background: C.greenSoft, color: C.green }}
            >
              報告已生成，學生已收到通知。
            </div>
            <div className="flex justify-end">
              <Btn kind="gold" size="sm" onClick={onClose}>
                關閉
              </Btn>
            </div>
          </>
        ) : (
          <>
            {/* 老師手記 */}
            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{ color: C.muted }}
              >
                老師手記（選填）
              </label>
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  borderColor: C.line,
                  color: C.text,
                  minHeight: 72,
                  resize: "vertical",
                }}
                placeholder="這堂課有什麼特別的觀察？"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
            </div>

            {/* VTT 上傳 */}
            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{ color: C.muted }}
              >
                VTT 轉錄檔 <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="file"
                accept=".vtt"
                className="w-full text-sm"
                style={{ color: C.text }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
              {file && (
                <div className="text-xs mt-1" style={{ color: C.muted }}>
                  {file.name}
                </div>
              )}
            </div>

            {status === "error" && (
              <div
                className="rounded-lg p-3 text-sm"
                style={{ background: C.redSoft, color: C.red, border: `1px solid ${C.red}` }}
              >
                發生錯誤，請再試一次。{errorMsg ? `（${errorMsg}）` : ""}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {busy && (
                <span className="text-xs mr-auto" style={{ color: C.muted }}>
                  {status === "uploading"
                    ? "上傳中…"
                    : "AI 分析中，約需 30–60 秒…"}
                </span>
              )}
              <Btn kind="ghost" size="sm" onClick={onClose} disabled={busy}>
                關閉
              </Btn>
              <Btn kind="gold" size="sm" onClick={handleSubmit} disabled={!file || busy}>
                {status === "error" ? "重試" : "生成報告"}
              </Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
