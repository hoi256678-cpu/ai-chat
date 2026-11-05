// 화면에 그대로 보여 줘도 되는 오류(우리 API가 만든 한국어 안내 문구)만 이 클래스로 던진다.
// 그 밖의 오류("Failed to fetch", Vercel 시간 초과 HTML을 JSON으로 읽다 난 SyntaxError,
// Supabase의 영어 DB 오류 등)는 내부 사정이 드러나므로 기본 문구로 바꿔 보여 준다.
export class UserFacingError extends Error {}

export function messageForUser(error: unknown, fallback: string): string {
  return error instanceof UserFacingError ? error.message : fallback;
}
