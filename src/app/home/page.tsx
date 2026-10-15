import { ArrowRight, BadgeCheck, CircleCheck, Clock, FileText, IdCard, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";

export default async function Home() {
  const lang = await getLang();

  const steps = [
    { icon: <IdCard />, title: t(lang, "how1Title"), text: t(lang, "how1Text") },
    { icon: <FileText />, title: t(lang, "how2Title"), text: t(lang, "how2Text") },
    { icon: <BadgeCheck />, title: t(lang, "how3Title"), text: t(lang, "how3Text") },
  ];

  return (
    <>
      {/* Banner in the logo's own blue, with the lion emblem */}
      <section className="track-lanes bg-brand text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[1.15fr_1fr] lg:py-20">
          <div className="flex flex-col items-start gap-5">
            <Image src="/brand/slaa-lion.png" alt="" width={409} height={245} priority
              className="h-auto w-40 md:hidden" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium sm:text-sm">
              <Clock className="size-4" aria-hidden />
              {t(lang, "homeTime")}
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {t(lang, "homeTitle")}
            </h1>
            <span className="h-1.5 w-20 rounded-full bg-gold" aria-hidden />
            <p className="max-w-xl text-base text-pretty text-white/85 sm:text-lg">{t(lang, "homeIntro")}</p>
            <Link
              href="/register/check"
              className="group inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold px-6 py-3 text-base font-bold text-brand-deep shadow-lg shadow-black/20 transition hover:brightness-105 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-px sm:w-auto sm:text-lg"
            >
              {t(lang, "homeAthleteTitle")}
              <ArrowRight className="size-5 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>

          <div aria-hidden className="hidden flex-col items-center gap-6 md:flex">
            <Image src="/brand/slaa-lion.png" alt="" width={409} height={245} priority className="h-auto w-full max-w-sm drop-shadow-xl" />
            <div className="w-full max-w-xs rotate-2 rounded-2xl bg-white p-5 text-foreground shadow-2xl ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">{t(lang, "cardOrg")}</span>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {t(lang, "cardAthlete")}
                </span>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">{t(lang, "cardSlaaId")}</p>
              <p className="font-mono text-2xl font-bold tracking-wider">A26-000123-4</p>
              <div className="mt-4 h-1.5 w-20 rounded-full bg-gold" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="text-xl font-bold sm:text-2xl">{t(lang, "howTitle")}</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-4 rounded-2xl border bg-background p-5 shadow-xs md:flex-col">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                {s.icon}
                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-background p-5 shadow-xs">
            <h2 className="font-semibold">{t(lang, "needTitle")}</h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-sm">
              {(["need1", "need2", "need3"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2.5">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  {t(lang, k)}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Info className="size-4 text-primary" aria-hidden />
              {t(lang, "homeAlreadyTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">{t(lang, "homeAlreadyText")}</p>
          </div>
        </div>
      </div>
    </>
  );
}
