// 通用工具函式

export const money = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("zh-TW");

export const uid = (p = "id") =>
  p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const todayYMD = () => fmt(new Date());

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
