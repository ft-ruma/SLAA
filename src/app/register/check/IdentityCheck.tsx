"use client";

import { ArrowRight, Info, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FormError } from "@/components/Field";
import { IdentityFields, emptyIdentity, toIdentity, type IdentityValues } from "@/components/IdentityFields";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { useT } from "@/components/LangProvider";
import { PageTitle, StickyActions, Stepper } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { saveCheckedIdentity } from "@/lib/registration-state";
import { identitySchema } from "@/lib/validation";

type Existing = { slaaId: string; maskedName: string; district: string };

export function IdentityCheck() {
  const router = useRouter();
  const { t, district } = useT();
  const [values, setValues] = useState<IdentityValues>(emptyIdentity);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Existing | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = identitySchema.safeParse(toIdentity(values));
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const token = (await turnstile.current?.getToken()) ?? "";
      if (!token) {
        setFormError(t("securityNotLoaded"));
        return;
      }
      const res = await fetch("/api/identity-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: parsed.data, turnstileToken: token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(body.error ?? t("serverError"));
        return;
      }
      if (body.exists) {
        setExisting(body);
        return;
      }
      saveCheckedIdentity({ identity: parsed.data });
      router.push("/register/athlete");
    } catch {
      setFormError(t("networkError"));
    } finally {
      setBusy(false);
      turnstile.current?.reset();
    }
  }

  if (existing) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6" data-testid="already-registered">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Info className="size-7" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">{t("alreadyTitle")}</h1>
        </div>
        <div className="rounded-2xl border-2 border-primary/30 bg-background p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("alreadyYourId")}</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-wider break-all sm:text-4xl">{existing.slaaId}</p>
          <p className="mt-3 text-sm">
            {existing.maskedName} · {district(existing.district)}
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground text-pretty">{t("alreadyText")}</p>
        <Button nativeButton={false} render={<Link href="/home" />} variant="outline"
          className="h-auto min-h-12 w-full rounded-xl text-base whitespace-normal sm:w-auto sm:self-center sm:px-8">
          {t("backToStart")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <Stepper current={1} />
      <PageTitle title={t("checkTitle")} intro={t("checkIntro")} />

      <div className="rounded-2xl border bg-background p-4 shadow-xs sm:p-6">
        <IdentityFields value={values} onChange={setValues} errors={errors} />
      </div>

      <FormError message={formError} />
      <Turnstile ref={turnstile} />

      <StickyActions>
        <Button type="submit" disabled={busy}
          className="h-auto min-h-12 w-full gap-2 rounded-xl py-2 text-base whitespace-normal sm:min-h-13 sm:text-lg">
          {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
          {busy ? t("checking") : t("continue")}
          {!busy && <ArrowRight className="size-5" aria-hidden />}
        </Button>
      </StickyActions>
    </form>
  );
}
