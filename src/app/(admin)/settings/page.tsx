import { createClient } from "@/lib/supabase/server";
import { EmailToggle } from "../EmailToggle";
import PasswordCard from "./PasswordCard";
import PageIntro from "@/components/ui/PageIntro";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: meta } = await supabase
    .from("app_meta")
    .select("email_notifications_enabled")
    .eq("id", 1)
    .maybeSingle();
  const emailEnabled = meta?.email_notifications_enabled ?? false;

  return (
    <div className="space-y-4">
      <PageIntro storageKey="settings" title="設定 · 說明">
        <p>系統層級的設定集中在這裡,不影響個別學生或課程資料。</p>
      </PageIntro>

      <div className="space-y-4 max-w-2xl">
        <PasswordCard email={user?.email ?? null} />
        <EmailToggle enabled={emailEnabled} />
      </div>
    </div>
  );
}
