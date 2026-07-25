import { createBrowserClient } from "@supabase/ssr";
import { parse, serialize, type SerializeOptions } from "cookie";

// Stores the session in cookies (not localStorage) so proxy.ts can read
// the logged-in state server-side.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function documentCookieGetAll() {
  const parsed = parse(document.cookie);
  return Object.keys(parsed).map((name) => ({
    name,
    value: parsed[name] ?? "",
  }));
}

// @supabase/ssr's default document.cookie writer always forces a ~400-day
// Max-Age on every session cookie (see node_modules/@supabase/ssr/dist/*/cookies.js).
// To make "stay logged in" optional, we mirror that same writer but drop
// Max-Age/Expires when persist is false — a cookie with neither attribute
// is a session cookie, cleared when the browser fully closes. maxAge: 0
// (sign-out's delete) is always honored so logging out still works.
function makeSessionCookieSetAll() {
  return (
    cookiesToSet: { name: string; value: string; options: SerializeOptions }[]
  ) => {
    cookiesToSet.forEach(({ name, value, options }) => {
      const cookieOptions = { ...options };
      if (cookieOptions.maxAge !== 0) {
        delete cookieOptions.maxAge;
        delete cookieOptions.expires;
      }
      document.cookie = serialize(name, value, cookieOptions);
    });
  };
}

// Used only for the sign-in/sign-up call when the user unchecks "자동
// 로그인" — every other call site keeps using createClient() above
// unchanged.
export function createSessionOnlyClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
      cookies: {
        getAll: documentCookieGetAll,
        setAll: makeSessionCookieSetAll(),
      },
    }
  );
}
