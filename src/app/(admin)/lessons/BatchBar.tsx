"use client";

import { C } from "@/lib/constants";
import Btn from "@/components/ui/Btn";

interface Props {
  count: number;
  onComplete: () => void;
  onCancel: () => void;
  onSubstitute: () => void;
  onClear: () => void;
  isPending: boolean;
}

export default function BatchBar({ count, onComplete, onCancel, onSubstitute, onClear, isPending }: Props) {
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
        <Btn kind="ghost" size="sm" onClick={onClear} disabled={isPending}>
          取消選取
        </Btn>
        <button
          onClick={onSubstitute}
          disabled={isPending}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: C.gold, color: "#fff" }}
        >
          批次代課
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
