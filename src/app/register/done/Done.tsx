"use client";

import { Check, Copy, PartyPopper, Printer } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/LangProvider";
import { Stepper } from "@/components/Page";
import { Benefits } from "@/components/Benefits";
import { Button } from "@/components/ui/button";
import { loadDone, type DoneInfo } from "@/lib/registration-state";

export function Done() {
  const { t } = useT();
  const [info, setInfo] = useState<DoneInfo | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => setInfo(loadDone()), []);

  if (info === undefined) return null;
  if (info === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">{t("nothingTitle")}</h1>
        <p className="text-muted-foreground">{t("nothingText")}</p>
        <Link href="/home" className="text-primary underline">{t("goToStart")}</Link>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(info!.slaaId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; the ID is on screen to copy by hand
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper current={3} />
      <div className="no-print flex flex-col items-center gap-3 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
          <PartyPopper className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">{t("doneTitle")}</h1>
        <p className="max-w-md text-muted-foreground text-pretty">{t("doneKeep")}</p>
      </div>

      {/* printable card */}
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-background shadow-lg ring-1 ring-black/5 print:shadow-none print:ring-2 print:ring-primary">
        <div className="track-lanes flex items-center justify-between gap-3 bg-brand px-5 py-3 text-white print:bg-brand">
          <span className="flex items-center gap-2.5">
            <Image src="/brand/slaa-lion.png" alt="Sri Lanka Athletics" width={409} height={245} className="h-9 w-auto" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gold">{t("cardOrg")}</span>
          </span>
          <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-brand-deep">{t("cardAthlete")}</span>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">{t("cardSlaaId")}</p>
          <p data-testid="slaa-id" className="font-mono text-3xl font-bold tracking-wider break-all sm:text-4xl">
            {info.slaaId}
          </p>
          <p className="mt-4 text-lg font-medium">{info.name}</p>
          <div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
            <span className="size-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
            {t("cardStatus")}
          </div>
        </div>
      </div>

      <div className="no-print mx-auto grid w-full max-w-md gap-3 sm:grid-cols-2">
        <Button onClick={copy} className="h-auto min-h-12 gap-2 rounded-xl px-4 py-2 text-base whitespace-normal">
          {copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
          {copied ? t("copied") : t("copyId")}
        </Button>
        <Button onClick={() => window.print()} variant="outline"
          className="h-auto min-h-12 gap-2 rounded-xl px-4 py-2 text-base whitespace-normal">
          <Printer className="size-5" aria-hidden />
          {t("printCard")}
        </Button>
      </div>

      <div className="no-print mx-auto w-full max-w-xl rounded-2xl border bg-background p-5 text-sm shadow-xs">
        <p className="font-semibold">{t("nextTitle")}</p>
        <ul className="mt-3 flex flex-col gap-3 text-muted-foreground">
          {[t("next1"), t("next2"), ...(info.coachLinks > 0 ? [t("next3")] : [])].map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="text-pretty">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <Benefits />
    </div>
  );
}
