"use client";
import { useState, useTransition } from "react";
import { C } from "@/lib/constants";
import Card from "@/components/ui/Card";
import Btn from "@/components/ui/Btn";

export default function ReminderStartDate({ current }: { current: string | null }) {
  const [date, setDate] = useState(current ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await fetch("/api/settings/reminder-start-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <Card title="報告提醒起始日期">
      <p className="text-sm mb-4" style={{ color: C.muted }}>
        只有這個日期之後完成的課程才會觸發報告提醒通知。設定前的舊課程不會被提醒。
      </p>
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ borderColor: C.line, color: C.navy }}
        />
        <Btn kind="primary" size="sm" onClick={handleSave} disabled={!date || isPending}>
          {isPending ? "儲存中…" : saved ? "已儲存 ✓" : "儲存"}
        </Btn>
      </div>
      {current && (
        <p className="text-xs mt-2" style={{ color: C.muted }}>
          目前設定：{current}
        </p>
      )}
    </Card>
  );
}
