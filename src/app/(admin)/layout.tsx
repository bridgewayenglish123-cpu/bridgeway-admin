import Sidebar from "@/components/Sidebar";
import ConfirmProvider from "@/components/ConfirmProvider";
import { createClient } from "@/lib/supabase/server";
import { C } from "@/lib/constants";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: meta } = await supabase.from("app_meta").select("last_backup_at").eq("id", 1).single();
  const lastBackupAt = meta?.last_backup_at || null;

  return (
    <ConfirmProvider>
      <div className="min-h-screen lg:flex" style={{ background: C.bg }}>
        <Sidebar lastBackupAt={lastBackupAt} />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto p-3 md:p-5">{children}</div>
        </main>
      </div>
    </ConfirmProvider>
  );
}
