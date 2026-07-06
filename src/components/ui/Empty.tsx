"use client";
import { C } from "@/lib/constants";

export default function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4" style={{ color: C.muted }}>
      <div className="text-sm" style={{ lineHeight: 1.7 }}>{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
