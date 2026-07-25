// Supabase returns these in English — translate the common ones so the
// app never breaks into English mid-flow.
export function translateAuthError(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않아요.";
  }
  if (message.includes("already registered")) {
    return "이미 가입된 이메일이에요. 로그인해주세요.";
  }
  if (message.includes("Password should be at least")) {
    return "비밀번호는 6자 이상이어야 해요.";
  }
  if (message.includes("Unable to validate email")) {
    return "올바른 이메일 형식이 아니에요.";
  }
  return "문제가 발생했어요. 잠시 후 다시 시도해주세요.";
}
