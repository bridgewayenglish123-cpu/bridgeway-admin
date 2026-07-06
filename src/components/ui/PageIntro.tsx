"use client";
import { useState, useEffect } from "react";
import { C } from "@/lib/constants";

interface Props {
  storageKey: string;
  title: string;
  children: React.ReactNode;
}

export default function PageIntro({ storageKey, title, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const v = localStorage.getItem("bw_intro_" + storageKey);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, [storageKey]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("bw_intro_" + storageKey, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  if (!mounted) return null;

  if (collapsed) {
    return (
      <div className="mb-3 flex items-center justify-end">
        <button onClick={toggle} className="text-xs" style={{ color: C.muted, textDecoration: "underline" }}>
          顯示頁面說明
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg overflow-hidden" style={{ background: "#EAF0F6", border: `1px solid #C6D5E4` }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "#DDE7F1" }}>
        <span className="text-xs font-semibold" style={{ color: C.navy, letterSpacing: "0.05em" }}>{title}</span>
        <button onClick={toggle} className="text-xs" style={{ color: C.navy }}>收起</button>
      </div>
      <div className="px-4 py-3 text-xs" style={{ color: C.navy, lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  );
}
