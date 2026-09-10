import { cookies } from "next/headers";
import SettingsClient from "./SettingsClient";
import { THEME_COOKIE_NAME, type ThemePreference } from "@/lib/theme";

export default async function SettingsPage() {
  const themeCookie = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const initialTheme: ThemePreference =
    themeCookie === "light" || themeCookie === "dark" ? themeCookie : "system";

  return <SettingsClient initialTheme={initialTheme} />;
}
