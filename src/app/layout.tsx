import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { PwaRegister } from "@/components/pwa-register";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "KEYARCADE_1100 — Yamaha & Casio 1100 Gamified Piano & Score Platform",
  description:
    "Gamified Yamaha (KBP-1100, PSR-1100) & Casio (PX-S1100, WK-1100, CTK-1100) teaching platform with Web MIDI, Mic Pitch, Grand Staff + Jianpu, and falling-note arcade.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KEYARCADE_1100",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className={`${mono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col overflow-x-hidden bg-[#0a0a0a] text-[#e0e0e0] font-mono terminal-grid-bg">
        <div className="crt-overlay" />
        <I18nProvider>
          <PwaRegister />
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-[#1b1b1b] bg-[#090909] py-4 text-center text-[11px] text-[#555]">
            <div className="mx-auto max-w-6xl px-4 flex flex-wrap items-center justify-between gap-2">
              <span>
                KEYARCADE_1100 // YAMAHA &amp; CASIO 1100 SERIES [88K / 76K / 61K] TEACHING TERMINAL
              </span>
              <span className="text-[#00ff88]">
                ● WEB MIDI &amp; MIC PITCH READY · AUTO STAFF + JIANPU · ARCADE MODE
              </span>
            </div>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
