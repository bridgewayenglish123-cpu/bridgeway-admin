import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { date } = await req.json();
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_meta")
    .update({ reminder_start_date: date, updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
