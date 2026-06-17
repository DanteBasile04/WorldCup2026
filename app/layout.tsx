import type { Metadata } from "next";
import { Montserrat, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
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
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
