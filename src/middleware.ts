import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LANG_COOKIE, isLang } from "@/lib/i18n";

// 1. Public pages: the front page (/) is the language screen. A visitor who
//    lands deeper in the site without having chosen a language is sent there
//    first, then back to where they were going.
// 2. Admin pages: keeps the Supabase session fresh. Access control itself
//    happens in requireAdmin()/getAdmin() on every admin page, action and API route.
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/home" || pathname.startsWith("/register")) {
    if (isLang(request.cookies.get(LANG_COOKIE)?.value)) return NextResponse.next();
    const to = new URL("/", request.url);
    to.searchParams.set("next", pathname + search);
    return NextResponse.redirect(to);
  }

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/home", "/register/:path*", "/admin/:path*", "/api/admin/:path*", "/auth/:path*"],
};
