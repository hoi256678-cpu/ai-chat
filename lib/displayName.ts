// 인사말("안녕하세요, ○○님")에 쓸 이름. 서버(app/main/page.tsx)와 브라우저(MainClient)가 같은 규칙을 쓴다.
// 가입 때 정한 닉네임을 먼저 쓰고, 닉네임이 생기기 전에 만든 계정은 이메일 @ 앞부분으로 대신한다
// (전체 주소를 그대로 쓰면 너무 길다).
export function displayNameOf(
  metadata: { nickname?: unknown } | null | undefined,
  email: string | null | undefined
): string {
  const nickname = typeof metadata?.nickname === "string" ? metadata.nickname.trim() : "";
  return nickname || email?.split("@")[0] || "";
}
