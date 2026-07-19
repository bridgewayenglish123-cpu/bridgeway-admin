import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { teacherId, hint } = await req.json();
  if (!teacherId) return NextResponse.json({ error: "teacherId required" }, { status: 400 });
  
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("teachers")
    .update({ portal_password_hint: hint })
    .eq("id", teacherId);
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
