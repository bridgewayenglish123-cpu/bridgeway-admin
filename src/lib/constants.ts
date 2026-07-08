// Bridgeway 品牌設計 tokens

export const C = {
  bg: "#FAF7EF",
  card: "#FFFFFF",
  navy: "#0F2A4A",
  navySoft: "#1E3A5F",
  navyDark: "#0A1E36",
  gold: "#C2992F",
  goldSoft: "#E8D9A8",
  muted: "#6B7B8E",
  line: "#E5DFCF",
  text: "#1F2937",
  red: "#B91C1C",
  redSoft: "#FEE2E2",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  amber: "#B45309",
  amberSoft: "#FEF3C7",
  shadow: "0 2px 8px rgba(15,42,74,0.06)",
  shadowSoft: "0 1px 3px rgba(15,42,74,0.04)",
} as const;

export const PHP_RATE_DEFAULT = 1.8;

// Hanne 抽成截止日:此日之後(不含)的完課,Hanne 不再抽成
export const HANNE_COMMISSION_CUTOFF = "2026-07-05";

export const WD = ["日", "一", "二", "三", "四", "五", "六"];

export const TABS = [
  { key: "", label: "儀表板" },
  { key: "lessons", label: "課程管理" },
  { key: "accounts", label: "學員課程" },
  { key: "schedule", label: "排課管理" },
  { key: "students", label: "學生管理" },
  { key: "teachers", label: "老師管理" },
  { key: "rules", label: "價格規則" },
  { key: "remit", label: "匯款總覽" },
];

export const ACC_STATUS_LABEL: Record<string, string> = {
  Active: "進行中",
  Trial: "試聽中",
  Closed: "已結束",
  Completed: "已完課",
};
