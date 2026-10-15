"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo } from "react";
import {
  LANG_LABELS,
  categoryName,
  districtName,
  eventName,
  provinceOf,
  t,
  tErr,
  type Lang,
  type MessageKey,
} from "@/lib/i18n";

const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** Translation helpers bound to the current language. */
export function useT() {
  const lang = useContext(LangContext);
  return useMemo(
    () => ({
      lang,
      t: (key: MessageKey, vars?: Record<string, string>) => t(lang, key, vars),
      tErr: (message: string | undefined | null) => tErr(lang, message),
      district: (d: string) => districtName(lang, d),
      province: (d: string) => provinceOf(lang, d),
      event: (code: string) => eventName(lang, code),
      category: (c: string) => categoryName(lang, c),
    }),
    [lang],
  );
}

/** Small header link showing the current language; opens the language screen. */
export function LanguageLink() {
  const { lang, t } = useT();
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/admin")) return null;
  return (
    <Link
      href={`/?next=${encodeURIComponent(pathname)}`}
      aria-label={t("changeLanguage")}
      className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-2.5 text-sm text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-gold"
    >
      <Languages className="size-4" aria-hidden />
      <span lang={lang}>{LANG_LABELS[lang]}</span>
    </Link>
  );
}
