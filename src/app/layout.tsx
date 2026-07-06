import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bridgeway Admin",
  description: "Bridgeway English 內部管理系統",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant" className={`${cormorant.variable} ${notoSansTC.variable}`}>
      <body>{children}</body>
    </html>
  );
}
