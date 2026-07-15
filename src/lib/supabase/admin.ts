import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client —— 只能在 server-side（API routes）使用。
// 使用 SUPABASE_SERVICE_ROLE_KEY，會 bypass RLS，絕不可出現在前端或 NEXT_PUBLIC_ 變數。
// 頂部 `import "server-only"` 為 build-time 保護：被任何 Client Component 匯入會直接編譯失敗。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
