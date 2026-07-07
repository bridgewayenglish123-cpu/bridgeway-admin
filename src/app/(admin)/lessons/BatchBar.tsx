"use client";

import { C } from "@/lib/constants";

interface Props {
  count: number;
  onComplete: () => void;
  onCancel: () => void;
  onClear: () => void;
  isPending: boolean;
}

export default function BatchBar({ count, onComplete, onCancel, onClear, isPending }: Props) {
  return (
    <div
      className="sticky top-0 z-20 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3"
      style={{
        background: C.navy,
        boxShadow: "0 4px 16px rgba(15,42,74,0.20)",
      }}
    >
      <div className="text-sm font-medium text-white">
        已選 <span style={{ color: C.goldSoft }}>{count}</span> 堂
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onClear}
          disabled={isPending}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.4)" }}
        >
          取消選取
        </button>
        <button
          onClick={onCancel}
          disabled={isPending}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "rgba(185,28,28,0.85)", color: "#fff" }}
        >
          批次取消
        </button>
        <button
          onClick={onComplete}
          disabled={isPending}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: "#16A34A", color: "#fff" }}
        >
          {isPending ? "處理中…" : "批次完成"}
        </button>
      </div>
    </div>
  );
}
