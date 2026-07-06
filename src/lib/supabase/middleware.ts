import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 重要:一定要呼叫 getUser() 才會 refresh session
  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const isLoginPage = url.pathname.startsWith("/login");
  const isAuthCallback = url.pathname.startsWith("/auth/callback");

  // 未登入且不在登入頁 → 導去登入頁
  if (!user && !isLoginPage && !isAuthCallback) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 已登入卻在登入頁 → 導去儀表板
  if (user && isLoginPage) {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
