import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed middleware.ts -> proxy.ts and `middleware` -> `proxy`.
// `matcher` below is an explicit allowlist of protected PAGES only —
// /api/chat and /api/symptom-check are never matched, so a Supabase
// outage can never block the Gemini routes.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Middleware/proxy has no access to next/headers' cookies() (that's
  // Server Component/Route Handler only) — session cookies are read and
  // written directly on the request/response instead.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/main",
    "/chat",
    "/chats/:path*",
    "/symptom-check/:path*",
    "/settings",
    "/medications",
    "/medications/:path*",
    "/health-records",
  ],
};
