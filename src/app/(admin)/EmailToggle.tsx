"use client";
import { useState, useTransition } from "react";
import { setEmailNotifications } from "@/app/actions/meta";
import { C } from "@/lib/constants";

export function EmailToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    startTransition(async () => {
      const res = await setEmailNotifications(next);
      if (!res.error) setOn(next);
    });
  };

  return (
    <div className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div>
        <div className="text-sm font-semibold" style={{ color: C.navy }}>
          學生 Email 通知
        </div>
        <div className="text-xs mt-0.5" style={{ color: C.muted }}>
          {on ? "開啟 — 報告生成後自動發 email 給學生" : "關閉 — 報告生成後不發 email"}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={isPending}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
        style={{ background: on ? C.green : C.muted }}>
        <span
          className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
          style={{ transform: on ? "translateX(24px)" : "translateX(4px)" }}
        />
      </button>
    </div>
  );
}
