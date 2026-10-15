"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/Page";
import { LANG_COOKIE, LANG_LABELS, LANGS, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The first screen: the visitor has not read anything yet, so every line
// here is shown in all three languages.
const CONTINUE: Record<Lang, string> = {
  en: "Continue in English",
  si: "සිංහලෙන් ඉදිරියට යන්න",
  ta: "தமிழில் தொடரவும்",
};

export function LanguageChoice({ next, current }: { next: string; current: Lang | null }) {
  const router = useRouter();

  function choose(l: Lang) {
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(next);
    router.refresh();
  }

  return (
    <PageContainer className="flex flex-1 flex-col justify-center md:max-w-4xl">
      <div className="text-center">
        <Image src="/brand/slaa-logo.png" alt="Sri Lanka Athletics" width={160} height={160} priority
          className="mx-auto mb-6 size-28 rounded-3xl shadow-xl shadow-brand/25 ring-4 ring-gold/70 sm:size-36" />
        <h1 className="text-2xl font-bold sm:text-3xl">Choose your language</h1>
        <p className="mt-1.5 text-lg font-semibold text-muted-foreground sm:text-xl" lang="si">භාෂාව තෝරන්න</p>
        <p className="mt-1 text-lg font-semibold text-muted-foreground sm:text-xl" lang="ta">மொழியைத் தெரிவு செய்யவும்</p>
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-md gap-3 md:max-w-none md:grid-cols-3 md:gap-4" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={current === l}
            onClick={() => choose(l)}
            className={cn(
              "flex min-h-22 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-background px-4 py-4 shadow-sm transition md:min-h-36",
              "hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary active:translate-y-0",
              current === l ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-border",
            )}
          >
            <span className="text-2xl font-bold md:text-3xl">{LANG_LABELS[l]}</span>
            <span className="text-sm text-muted-foreground">{CONTINUE[l]}</span>
          </button>
        ))}
      </div>
    </PageContainer>
  );
}
