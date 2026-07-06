import { createClient } from "@/lib/supabase/server";
import { todayYMD } from "@/lib/utils";

export async function POST() {
  const supabase = createClient();

  const [
    teachersRes, studentsRes, priceRulesRes, enrollmentsRes,
    accountsRes, scheduleRulesRes, lessonsRes,
    remitRes, extrasRes, metaRes,
  ] = await Promise.all([
    supabase.from("teachers").select("*"),
    supabase.from("students").select("*"),
    supabase.from("price_rules").select("*"),
    supabase.from("enrollments").select("*"),
    supabase.from("accounts").select("*"),
    supabase.from("schedule_rules").select("*"),
    supabase.from("lessons").select("*"),
    supabase.from("remittance_periods").select("*"),
    supabase.from("remittance_extras").select("*"),
    supabase.from("app_meta").select("*").eq("id", 1).single(),
  ]);

  const snapshot = {
    _app: "Bridgeway English Admin",
    _version: 2,
    _exported_at: new Date().toISOString(),
    teachers: teachersRes.data,
    students: studentsRes.data,
    priceRules: priceRulesRes.data,
    enrollments: enrollmentsRes.data,
    accounts: accountsRes.data,
    scheduleRules: scheduleRulesRes.data,
    lessons: lessonsRes.data,
    remittancePeriods: remitRes.data,
    remittanceExtras: extrasRes.data,
    meta: metaRes.data,
  };

  // 更新 last_backup_at
  await supabase
    .from("app_meta")
    .update({ last_backup_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", 1);

  const filename = "bridgeway-snapshot-" + todayYMD() + ".json";

  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
