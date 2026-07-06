"use client";
import { useState } from "react";
import { C } from "@/lib/constants";

interface Props {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
  collapsible?: boolean;
  storageKey?: string;
  defaultCollapsed?: boolean;
}

export default function Card({ title, right, children, pad = true, collapsible, storageKey, defaultCollapsed = true }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false;
    if (typeof window !== "undefined" && storageKey) {
      try {
        const v = localStorage.getItem("bw_card_" + storageKey);
        if (v === "1") return true;
        if (v === "0") return false;
      } catch {}
    }
    return defaultCollapsed;
  });

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (storageKey && typeof window !== "undefined") {
        try { localStorage.setItem("bw_card_" + storageKey, next ? "1" : "0"); } catch {}
      }
      return next;
    });
  };

  return (
    <div className="rounded-xl" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}>
      {(title || right) && (
        <div
          className="flex items-center justify-between gap-3 flex-wrap px-3 md:px-4 py-3"
          style={{
            borderBottom: collapsed ? "none" : `1px solid ${C.line}`,
            cursor: collapsible ? "pointer" : "default",
          }}
          onClick={collapsible ? toggle : undefined}
        >
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.navy }}>
            {collapsible && <span className="text-xs" style={{ color: C.muted }}>{collapsed ? "▶" : "▼"}</span>}
            {title}
          </h3>
          {right && <div onClick={(e) => e.stopPropagation()}>{right}</div>}
        </div>
      )}
      {!collapsed && <div className={pad ? "p-3 md:p-4" : ""}>{children}</div>}
    </div>
  );
}
