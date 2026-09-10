import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { DoseToaster } from "@/components/DoseToaster";
import { THEME_COOKIE_NAME } from "@/lib/theme";

// Wordmark + numerals only (STEP counters, dates) — Korean body text uses
// Pretendard, loaded via the <link> below. Space Grotesk never touches
// Korean glyphs, so there's no CJK fallback-mismatch risk.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "HealthMate",
  description: "매일의 대화와 몸 상태를 편하게 기록하는 AI 다이어리",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the 화면 모드 choice (see lib/theme.ts) server-side so the
  // correct data-theme lands in the very first response — no client
  // script, no flash, no hydration mismatch to fight.
  const themeCookie = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const dataTheme = themeCookie === "light" || themeCookie === "dark" ? themeCookie : undefined;

  return (
    <html
      lang="ko"
      data-theme={dataTheme}
      className={`${spaceGrotesk.variable} h-dvh antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden">
        {children}
        <DoseToaster />
      </body>
    </html>
  );
}
