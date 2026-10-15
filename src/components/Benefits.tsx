"use client";

import { CircleCheck, GraduationCap, Medal, Trophy } from "lucide-react";
import Image from "next/image";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "./LangProvider";

const BENEFITS: { icon: React.ReactNode; title: MessageKey; points: MessageKey[] }[] = [
  { icon: <Trophy />, title: "b1Title", points: ["b1a", "b1b"] },
  { icon: <Medal />, title: "b2Title", points: ["b2a", "b2b"] },
  { icon: <GraduationCap />, title: "b3Title", points: ["b3a", "b3b"] },
];

/** Shown after registering: why the new SLAA ID matters to a student athlete. */
export function Benefits() {
  const { t } = useT();
  return (
    <section aria-labelledby="benefits-title" className="no-print overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="track-lanes flex items-center gap-4 bg-brand px-5 py-5 text-white sm:px-6">
        <Image src="/brand/slaa-lion.png" alt="" width={409} height={245} className="h-12 w-auto shrink-0 sm:h-14" />
        <div>
          <h2 id="benefits-title" className="text-lg font-bold leading-tight sm:text-xl">{t("benefitsTitle")}</h2>
          <p className="mt-1 text-sm text-white/85">{t("benefitsIntro")}</p>
        </div>
      </div>
      <ol className="divide-y">
        {BENEFITS.map((b, i) => (
          <li key={b.title} className="grid gap-3 p-5 sm:p-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-6">
            <div className="flex min-w-0 items-center gap-3 md:items-start">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                {b.icon}
                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-gold text-[11px] font-bold text-brand-deep">
                  {i + 1}
                </span>
              </span>
              <h3 className="min-w-0 font-semibold leading-snug break-words text-balance md:pt-2">{t(b.title)}</h3>
            </div>
            <ul className="flex min-w-0 flex-col gap-2.5 text-sm text-muted-foreground">
              {b.points.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0 break-words text-pretty">{t(p)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
