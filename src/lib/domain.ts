// 業務邏輯:期別計算、Hanne 抽成截止、有效抽成計算等

import { HANNE_COMMISSION_CUTOFF } from "./constants";
import type { Lesson, PayoutSnapshot } from "./supabase/types";
import { fmt, parseYMD } from "./utils";

// ---- 匯款期別:每月 10-24 → 25 匯 / 25-次月 9 → 次月 10 匯 ----
export interface Period {
  key: string;      // "2026-07-10" or "2026-06-25" 等
  label: string;    // "2026/07/10 - 2026/07/24"
  remit: string;    // 匯款日 "2026-07-25"
  start: string;
  end: string;
}

export function periodOf(dateYMD: string): Period {
  const d = parseYMD(dateYMD);
  if (!d) throw new Error(`Invalid date: ${dateYMD}`);
  const day = d.getDate();
  let year = d.getFullYear();
  let month = d.getMonth() + 1;

  if (day >= 10 && day <= 24) {
    // 上半期
    const start = new Date(year, month - 1, 10);
    const end = new Date(year, month - 1, 24);
    const remit = new Date(year, month - 1, 25);
    return {
      key: fmt(start),
      label: `${fmt(start).replace(/-/g, "/")} - ${fmt(end).replace(/-/g, "/")}`,
      remit: fmt(remit),
      start: fmt(start),
      end: fmt(end),
    };
  } else {
    // 下半期或跨月
    let startY = year, startM = month, startD = 25;
    let endY = year, endM = month + 1, endD = 9;
    if (day < 10) {
      // 1-9 號:屬於上一期
      startY = month === 1 ? year - 1 : year;
      startM = month === 1 ? 12 : month - 1;
      endY = year;
      endM = month;
    }
    const start = new Date(startY, startM - 1, startD);
    const endDate = new Date(endY, endM - 1, endD);
    const remit = new Date(endY, endM - 1, 10);
    return {
      key: fmt(start),
      label: `${fmt(start).replace(/-/g, "/")} - ${fmt(endDate).replace(/-/g, "/")}`,
      remit: fmt(remit),
      start: fmt(start),
      end: fmt(endDate),
    };
  }
}

// ---- Hanne 抽成截止規則 ----
export function isPostHanneCutoff(date: string): boolean {
  return date > HANNE_COMMISSION_CUTOFF;
}

export function effectiveHanneShare(lesson: Lesson): number {
  const s = lesson.payout_snapshot || ({} as PayoutSnapshot);
  if (isPostHanneCutoff(lesson.date)) return 0;
  return s.hanne_share_ntd || 0;
}

export function effectiveLeeCommission(lesson: Lesson): number {
  const s = lesson.payout_snapshot || ({} as PayoutSnapshot);
  const stored = s.lee_commission_ntd || 0;
  if (isPostHanneCutoff(lesson.date)) {
    return stored + (s.hanne_share_ntd || 0);
  }
  return stored;
}
