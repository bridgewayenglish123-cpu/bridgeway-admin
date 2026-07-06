import { createClient } from "@/lib/supabase/server";
import { C } from "@/lib/constants";
import { money, todayYMD, weekRange } from "@/lib/utils";
import { periodOf, effectiveHanneShare, effectiveLeeCommission } from "@/lib/domain";
import Card from "@/components/ui/Card";
import Empty from "@/components/ui/Empty";
import Badge from "@/components/ui/Badge";
import { Table, Td } from "@/components/ui/Table";
import type { Lesson, Student, Teacher, Account, RemittancePeriod } from "@/lib/supabase/types";

async function loadData() {
  const supabase = createClient();

  const [teachersRes, studentsRes, accountsRes, lessonsRes, remitRes, metaRes] = await Promise.all([
    supabase.from("teachers").select("*"),
    supabase.from("students").select("*"),
    supabase.from("accounts").select("*"),
    supabase.from("lessons").select("*"),
    supabase.from("remittance_periods").select("*"),
    supabase.from("app_meta").select("*").eq("id", 1).single(),
  ]);

  return {
    teachers: (teachersRes.data || []) as Teacher[],
    students: (studentsRes.data || []) as Student[],
    accounts: (accountsRes.data || []) as Account[],
    lessons: (lessonsRes.data || []) as Lesson[],
    remit: (remitRes.data || []) as RemittancePeriod[],
    phpRate: metaRes.data?.php_rate || 1.8,
  };
}

export default async function DashboardPage() {
  const { teachers, students, accounts, lessons, remit, phpRate } = await loadData();

  const today = todayYMD();
  const wk = weekRange();
  const curPeriod = periodOf(today);

  // 今日、本週、逾期
  const todayLessons = lessons.filter((l) => l.is_active && l.status === "scheduled" && l.date === today);
  const weekLessons = lessons.filter((l) => l.is_active && l.status === "scheduled" && l.date >= wk.start && l.date <= wk.end);
  const overdueLessons = lessons.filter((l) => l.is_active && l.status === "scheduled" && l.date < today);

  // 正在陪伴的學生數(有進行中且剩餘的正式帳戶)
  const activeStudentIds = new Set<string>();
  for (const a of accounts) {
    if (a.status_override === "Closed") continue;
    if (a.is_trial) continue;
    const completed = lessons.filter((l) => l.account_id === a.id && l.is_active && l.status === "completed").length;
    const remaining = a.total_lessons - completed;
    if (remaining > 0) activeStudentIds.add(a.student_id);
  }
  const activeStudentCount = activeStudentIds.size;

  // 本期匯款金額
  let curRemitNtd = 0;
  for (const l of lessons) {
    if (!l.is_active || l.status !== "completed") continue;
    const p = periodOf(l.date);
    if (p.key !== curPeriod.key) continue;
    curRemitNtd += (l.payout_snapshot?.teacher_payout_ntd || 0) + effectiveHanneShare(l);
  }

  // 本期 Lee 收入
  let curLeeIncome = 0;
  for (const l of lessons) {
    if (!l.is_active || l.status !== "completed") continue;
    const p = periodOf(l.date);
    if (p.key !== curPeriod.key) continue;
    curLeeIncome += effectiveLeeCommission(l);
  }

  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));
  const teacherById = Object.fromEntries(teachers.map((t) => [t.id, t]));

  const stat = (label: string, value: string, sub: string, tone: string = C.navy) => (
    <div className="rounded-xl p-4 md:p-5" style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadowSoft }}>
      <div className="text-xs" style={{ color: C.muted }}>{label}</div>
      <div className="text-xl md:text-2xl font-bold mt-1.5" style={{ color: tone, fontFamily: "'Noto Serif TC',serif" }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: C.muted }}>{sub}</div>
    </div>
  );

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 歡迎區 */}
      <div className="pb-4 md:flex md:items-end md:justify-between md:flex-wrap md:gap-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="mb-3 md:mb-0">
          <div className="text-xs uppercase mb-1.5 bw-display-en" style={{ color: C.muted, letterSpacing: "0.24em", fontStyle: "italic" }}>
            Bridgeway English · Admin
          </div>
          <h2 className="text-2xl md:text-3xl" style={{ color: C.navy, letterSpacing: "0.02em" }}>儀表板</h2>
        </div>
        <div className="md:text-right">
          <div className="text-sm" style={{ color: C.text, letterSpacing: "0.05em" }}>{today}</div>
          {activeStudentCount > 0 && (
            <div className="text-xs mt-1" style={{ color: C.muted, letterSpacing: "0.03em" }}>
              Bridgeway 正在陪伴 <span style={{ color: C.gold, fontWeight: 500 }}>{activeStudentCount}</span> 位學生的英文旅程
            </div>
          )}
        </div>
      </div>

      {overdueLessons.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: C.redSoft, border: `1px solid ${C.red}` }}>
          <div className="text-sm font-semibold" style={{ color: C.red }}>
            ⚠ 有 {overdueLessons.length} 堂已過期課程尚未標記
          </div>
          <div className="text-xs mt-0.5" style={{ color: C.red }}>
            未標記的課不會計入匯款結算與 Lee 收入。建議先去處理。
          </div>
        </div>
      )}

      {/* 頂部 4 張 stat 卡 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stat("今日課程", `${todayLessons.length} 堂`, "需確認完成 / 取消")}
        {stat("本週課程", `${weekLessons.length} 堂`, `${wk.start} ~ ${wk.end}`)}
        {stat(
          "本期 Lee 收入",
          `NT$ ${money(curLeeIncome)}`,
          curLeeIncome === 0 ? "本期尚無完課" : `${curPeriod.label}(依已完課計算)`,
          C.green
        )}
        {stat(
          "本期應匯 PH Team",
          `₱ ${money(Math.round(curRemitNtd * phpRate))}`,
          curRemitNtd === 0
            ? "目前無待匯款"
            : `NT$ ${money(curRemitNtd)} · 匯款 ${curPeriod.remit}`,
          C.gold
        )}
      </div>

      {/* 今日課程 */}
      <Card title={`今日課程(${today})`}>
        {todayLessons.length === 0 ? (
          <Empty>今天沒有排定的課程。可以到「課程管理」看看本週安排。</Empty>
        ) : (
          <Table head={["時間", "學生", "老師", "類型", "狀態"]}>
            {todayLessons
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
              .map((l) => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <Td>{l.time || "—"}</Td>
                  <Td>{studentById[l.student_id]?.zh_name || "—"}</Td>
                  <Td>{teacherById[l.teacher_id || ""]?.teacher_name || "—"}</Td>
                  <Td>
                    <Badge tone={l.class_type === "makeup" ? "amber" : l.class_type === "extension" ? "navy" : "gray"}>
                      {l.class_type === "makeup" ? "補課" : l.class_type === "extension" ? "延伸" : "一般"}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone="gray">待上</Badge>
                  </Td>
                </tr>
              ))}
          </Table>
        )}
      </Card>

      {/* 本次 Session 已完成:資料層 */}
      <Card title="遷移進度">
        <div className="text-sm space-y-2" style={{ color: C.text, lineHeight: 1.7 }}>
          <div>✅ <strong>Session 1 完成</strong>:Supabase 資料庫已建立,{lessons.length} 堂課程資料已完整遷移</div>
          <div className="text-xs" style={{ color: C.muted }}>
            接下來 Session 2-4 會把其他頁面(老師管理、學生管理、學員課程、排課、課程、匯款)一一移植過來,
            並實作所有原本 MVP 的功能:PageIntro、確認視窗、動態下一步、資料健康檢查等。
          </div>
        </div>
      </Card>
    </div>
  );
}
