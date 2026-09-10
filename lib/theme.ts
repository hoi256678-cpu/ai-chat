export type ThemePreference = "system" | "light" | "dark";

// A cookie (not localStorage) so app/layout.tsx — a Server Component —
// can read it via next/headers' cookies() and render the correct
// data-theme attribute in the initial server-rendered HTML. A
// client-only localStorage read would only apply after hydration,
// and React's hydration reconciliation strips a data-theme attribute
// a client script adds if the server-rendered <html> didn't have it.
export const THEME_COOKIE_NAME = "theme-preference";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function applyTheme(theme: ThemePreference) {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export function setTheme(theme: ThemePreference) {
  document.cookie =
    theme === "system"
      ? `${THEME_COOKIE_NAME}=; path=/; max-age=0`
      : `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}`;
  applyTheme(theme);
}
