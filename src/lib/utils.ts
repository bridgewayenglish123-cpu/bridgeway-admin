// 通用工具函式

export const money = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("zh-TW");

export const uid = (p = "id") =>
  p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const todayYMD = () => {
  // 強制用 UTC+8(台灣時間),避免 Vercel 伺服器 UTC 時區問題
  const now = new Date();
  const twOffset = 8 * 60; // 分鐘
  const localOffset = now.getTimezoneOffset(); // 本地與 UTC 的差(分鐘,UTC+8 是 -480)
  const twNow = new Date(now.getTime() + (twOffset + localOffset) * 60 * 1000);
  return fmt(twNow);
};

export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(ymd: string, n: number): string {
  const d = parseYMD(ymd);
  if (!d) return ymd;
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export const weekdayOf = (ymd: string) => {
  const d = parseYMD(ymd);
  return d ? d.getDay() : 0;
};

// 本週(週一~週日)範圍
export function weekRange(): { start: string; end: string } {
  const now = new Date();
  const dow = now.getDay(); // 0 日
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now);
  mon.setDate(now.getDate() + offsetToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: fmt(mon), end: fmt(sun) };
}
