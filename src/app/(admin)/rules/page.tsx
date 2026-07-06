import { createClient } from "@/lib/supabase/server";
import type { PriceRule, Account } from "@/lib/supabase/types";
import RulesClient from "./RulesClient";

async function loadData() {
  const supabase = createClient();
  const [rulesRes, accountsRes] = await Promise.all([
    supabase.from("price_rules").select("*").order("teacher_type").order("duration_type").order("billing_type").order("lesson_count"),
    supabase.from("accounts").select("id,price_rule_code: enrollment_id").select("id,student_id"),
  ]);
  // 計算每條規則被幾個帳戶使用(透過 enrollments)
  const { data: enrollments } = await supabase.from("enrollments").select("price_rule_code");
  const usageCounts: Record<string, number> = {};
  for (const e of enrollments || []) {
    if (e.price_rule_code) {
      usageCounts[e.price_rule_code] = (usageCounts[e.price_rule_code] || 0) + 1;
    }
  }
  return {
    rules: (rulesRes.data || []) as PriceRule[],
    usageCounts,
  };
}

export default async function RulesPage() {
  const data = await loadData();
  return <RulesClient {...data} />;
}
