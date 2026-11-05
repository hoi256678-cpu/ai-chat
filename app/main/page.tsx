import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import MainClient from "./MainClient";
import { displayNameOf } from "@/lib/displayName";

// 인사말 이름을 서버에서 미리 읽어 첫 화면부터 넣는다("안녕하세요, 님" 깜빡임 방지).
// getClaims()는 로그인 쿠키의 토큰을 검증해 내용을 읽는다. 보통 네트워크 왕복 없이 끝나서
// getUser()(인증 서버 왕복)보다 빠르다. 로그인 여부 확인은 proxy.ts가 이미 했다.
export default async function MainPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // Server Component에서는 쿠키를 쓸 수 없다. 토큰 갱신(쿠키 쓰기)은 proxy.ts가 맡는다.
        setAll() {},
      },
    }
  );

  let initialName = "";
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    initialName = displayNameOf(
      claims?.user_metadata as { nickname?: unknown } | undefined,
      typeof claims?.email === "string" ? claims.email : undefined
    );
  } catch {
    // 이름을 못 읽어도 화면은 띄운다. 브라우저(MainClient)가 다시 채운다.
  }

  return <MainClient initialName={initialName} />;
}
