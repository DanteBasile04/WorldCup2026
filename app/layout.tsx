import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Montserrat, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-score",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "World Cup 2026",
  description: "Public groups, teams, and fixtures for the 2026 World Cup.",
  icons: {
    icon: [{ url: "/brand/world-cup-icon.png", type: "image/png" }],
    shortcut: "/brand/world-cup-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <footer className="border-t border-white/10 bg-white/[0.02]">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-6 py-4 text-sm text-slate-300 sm:px-10">
              <p>Enjoying the project?</p>
              <Link
                href="https://ko-fi.com/danteb04"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/10 px-4 py-2 font-semibold text-[var(--accent-gold-light)] transition hover:bg-[var(--accent-gold)]/20"
              >
                Support on Ko-fi
              </Link>
            </div>
          </footer>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
