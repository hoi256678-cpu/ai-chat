import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { DoseToaster } from "@/components/DoseToaster";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${spaceGrotesk.variable} h-dvh antialiased`}>
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
