import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { lessonId, note } = await req.json();
  if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("lessons")
    .update({ note, updated_at: new Date().toISOString() })
    .eq("id", lessonId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
