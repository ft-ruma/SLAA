import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { LangProvider, LanguageLink } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist has no Sinhala or Tamil glyphs; these fill in, self-hosted by next/font.
const notoSinhala = Noto_Sans_Sinhala({ variable: "--font-sinhala", subsets: ["sinhala"] });
const notoTamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"] });

export const metadata: Metadata = {
  title: "SLAA Registration",
  description: "Register as an athlete with Sri Lanka Athletics and receive your SLAA ID.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // lets the sticky bottom buttons sit above the iPhone home bar (safe-area insets)
  viewportFit: "cover",
  themeColor: "#0607f8",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = await getLang();
  const fonts = [geistSans, geistMono, notoSinhala, notoTamil].map((f) => f.variable).join(" ");

  return (
    <html lang={lang}>
      <body className={`${fonts} flex min-h-dvh flex-col bg-muted/40 font-sans antialiased`}>
        <LangProvider lang={lang}>
          <header className="no-print sticky top-0 z-30 bg-brand text-white shadow-md shadow-brand/20">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
              <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-gold">
                <Image src="/brand/slaa-lion.png" alt="" width={409} height={245} priority
                  className="h-10 w-auto shrink-0 sm:h-11" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold sm:text-base">{t(lang, "siteTitle")}</span>
                  <span className="truncate text-xs text-gold/90">{t(lang, "cardOrg")}</span>
                </span>
              </Link>
              <LanguageLink />
            </div>
          </header>
          <main className="flex w-full flex-1 flex-col">{children}</main>
          <footer className="no-print border-t bg-background">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-6 text-xs leading-relaxed text-muted-foreground sm:px-6">
              <Image src="/brand/slaa-logo.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-md" />
              <span>{t(lang, "footer")}</span>
            </div>
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}
