import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gainob Liquidity Dashboard",
  description: "Briefing dashboard for crypto liquidity and cycle rotation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
