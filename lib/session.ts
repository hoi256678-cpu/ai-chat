const SESSION_KEY = "ai-chat-session";

export type Session = {
  email: string;
};

// Placeholder auth: no password check, just remembers the email in
// localStorage. Swap this module out for real DB-backed auth later —
// callers only depend on get/set/clear so the API surface won't change.
export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}
