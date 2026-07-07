"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ConfirmProvider";
import { C, TABS } from "@/lib/constants";

interface SidebarProps {
  lastBackupAt?: string | null;
}

export default function Sidebar({ lastBackupAt }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const getBackupLabel = () => {
    if (!lastBackupAt) return "尚未備份";
    const days = Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000);
    if (days === 0) return "今天";
    if (days === 1) return "1 天前";
    return `${days} 天前${days > 7 ? " ⚠" : ""}`;
  };

  const handleExportSnapshot = async () => {
    try {
      const res = await fetch("/api/export-snapshot", { method: "POST" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bridgeway-snapshot-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const { askConfirm } = useConfirm();

  const handleLogout = () => {
    askConfirm({
      title: "登出",
      message: "即將登出系統。\n\n未儲存的變更會遺失(但目前所有操作都自動即時儲存)。",
      confirmLabel: "確認登出",
      onConfirm: async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      },
    });
  };

  const tabHrefFor = (key: string) => (key === "" ? "/" : `/${key}`);
  const isActive = (key: string) => {
    if (key === "") return pathname === "/";
    return pathname === `/${key}` || pathname.startsWith(`/${key}/`);
  };

  return (
    <>
      {/* 手機頂部 header */}
      <header
        className="sticky top-0 z-30 flex items-center gap-2 px-3 md:px-5 py-2.5 md:py-3 lg:hidden"
        style={{ background: C.card, borderBottom: `1px solid ${C.line}` }}
      >
        <button
          onClick={() => setNavOpen(true)}
          className="w-9 h-9 rounded flex items-center justify-center"
          style={{ background: "#EAF0F6", color: C.navy }}
          aria-label="打開選單"
        >
          ☰
        </button>
        <div className="bw-display-en text-lg" style={{ color: C.navy, letterSpacing: "0.03em" }}>
          Bridgeway
        </div>
      </header>

      {/* 側欄 */}
      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-72 lg:w-56 shrink-0 flex flex-col transition-transform duration-200 ${
          navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        style={{ background: C.navyDark }}
      >
        <div
          className="px-6 py-6 flex items-start justify-between"
          style={{ borderBottom: `1px solid ${C.navySoft}` }}
        >
          <div>
            <div
              className="text-white text-2xl bw-display-en"
              style={{ letterSpacing: "0.02em", fontWeight: 500 }}
            >
              Bridgeway
            </div>
            <div
              className="text-xs mt-1 bw-display-en"
              style={{
                color: C.goldSoft,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                fontStyle: "italic",
              }}
            >
              English Admin
            </div>
          </div>
          <button
            className="lg:hidden text-2xl w-8 h-8 flex items-center justify-center rounded"
            onClick={() => setNavOpen(false)}
            style={{ color: "#A9BBD0" }}
            aria-label="關閉選單"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {TABS.map(({ key, label }) => {
            const active = isActive(key);
            return (
              <Link
                key={key}
                href={tabHrefFor(key)}
                onClick={() => setNavOpen(false)}
                className="block transition-colors hover:bg-white/5"
                style={{
                  color: active ? "#fff" : "#A9BBD0",
                  background: active ? "rgba(194,153,47,0.08)" : "transparent",
                  borderLeft: active ? `2px solid ${C.gold}` : "2px solid transparent",
                  padding: "12px 24px",
                  fontSize: 15,
                  letterSpacing: "0.02em",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div
          className="px-5 py-4 space-y-2.5"
          style={{ borderTop: `1px solid ${C.navySoft}` }}
        >
          <button
            onClick={handleExportSnapshot}
            className="w-full px-2 py-2 rounded text-xs transition-opacity hover:opacity-80 mb-2"
            style={{ background: C.gold, color: "#fff", letterSpacing: "0.03em" }}
          >
            匯出 snapshot
          </button>
          {lastBackupAt !== undefined && (
            <div className="text-xs mb-2" style={{ color: "#7A93B8" }}>
              上次備份:{getBackupLabel()}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-2 py-2 rounded text-xs transition-opacity hover:opacity-80"
            style={{
              background: "transparent",
              color: "#7A93B8",
              border: `1px solid #16314F`,
              letterSpacing: "0.03em",
            }}
          >
            登出
          </button>
          <div className="text-xs" style={{ color: "#5E769A", letterSpacing: "0.05em" }}>
            雲端資料 · 自動保存
          </div>
        </div>
      </aside>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: "rgba(10,30,54,0.55)" }}
          onClick={() => setNavOpen(false)}
        />
      )}
    </>
  );
}
