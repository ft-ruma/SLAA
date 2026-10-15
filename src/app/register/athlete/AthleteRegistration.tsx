"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileCheck, History, LoaderCircle, PartyPopper, ShieldCheck, Trophy, UserRound, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form";
import { CoachSection, type CoachStatus, type CoachUiState } from "@/components/CoachSection";
import { EventRows, MAIN_EVENTS, emptyEventRow } from "@/components/EventRows";
import { Field, FormError, Section, inputClass } from "@/components/Field";
import { FormProgress, jumpTo, percentComplete, type ProgressItem } from "@/components/FormProgress";
import { IdentitySummary } from "@/components/IdentitySummary";
import { PageTitle, StickyActions, Stepper } from "@/components/Page";
import { useT } from "@/components/LangProvider";
import { ConsentBlock, PersonFields } from "@/components/PersonFields";
import { Turnstile, type TurnstileHandle } from "@/components/Turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseNic } from "@/lib/nic";
import {
  clearCheckedIdentity,
  clearDraft,
  loadCheckedIdentity,
  loadDraft,
  saveDone,
  saveDraft,
  type CheckedIdentity,
} from "@/lib/registration-state";
import { submitRegistration } from "@/lib/submit";
import { cn } from "@/lib/utils";
import { PHONE_REGEX, ageOn, athleteFormSchema, cleanPhone, type AthleteForm } from "@/lib/validation";

const emptyGuardian = { fullName: "", relationship: "", phone: "", nic: "", consent: false };

const DEFAULTS = {
  fullName: "",
  nameWithInitials: "",
  dateOfBirth: "",
  district: "",
  phone: "",
  schoolOrClub: "",
  events: Array.from({ length: MAIN_EVENTS }, () => emptyEventRow),
  guardian: null,
  coaches: [],
  unlistedCoaches: [],
} as unknown as AthleteForm;

// Each form field belongs to one section; used to jump to the first problem.
const SECTION_OF: Record<string, string> = {
  fullName: "sec-about", nameWithInitials: "sec-about", dateOfBirth: "sec-about", gender: "sec-about",
  district: "sec-about", phone: "sec-about", schoolOrClub: "sec-about",
  events: "sec-events", guardian: "sec-guardian", coaches: "sec-coaches", unlistedCoaches: "sec-coaches",
  consent: "sec-consent",
};
const SECTION_ORDER = ["sec-about", "sec-events", "sec-guardian", "sec-coaches", "sec-consent"];

// The coach questions are answered on screen, not in the schema ("I don't have a coach" and
// "No" are valid answers that leave both lists empty), so they are checked here.
const COACH_QUESTIONS_MSG = "Please answer both questions about your coaches.";

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const filled = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const phoneOk = (v: unknown) => typeof v === "string" && PHONE_REGEX.test(cleanPhone(v));

/** RHF keeps array item errors as arrays; flatten to index -> field -> message. */
function itemErrors(list: unknown) {
  const out: Record<number, Record<string, string>> = {};
  const arr = list as (Record<string, { message?: string }> | undefined)[] | undefined;
  if (Array.isArray(arr)) {
    arr.forEach((e, i) => {
      if (!e) return;
      out[i] = {};
      for (const [k, v] of Object.entries(e)) if (v?.message) out[i][k] = v.message;
    });
  }
  return out;
}

export function AthleteRegistration() {
  const router = useRouter();
  const { t, tErr } = useT();
  const [checked, setChecked] = useState<CheckedIdentity | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [coachInitial, setCoachInitial] = useState<CoachUiState | undefined>(undefined);
  const [coachState, setCoachState] = useState<CoachUiState | undefined>(undefined);
  const [coachStatus, setCoachStatus] = useState<CoachStatus>({ currentDone: false, pastAnswered: false });
  const [coachKey, setCoachKey] = useState(0); // remounts the coach section on "Start over"
  const [coachAttempted, setCoachAttempted] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm({ resolver: zodResolver(athleteFormSchema), defaultValues: DEFAULTS });

  const values = useWatch({ control });
  const dob = values.dateOfBirth ?? "";
  const district = values.district ?? "";
  const isMinor = isDate(dob) && ageOn(dob) < 18;

  useEffect(() => {
    if (isMinor && !getValues("guardian")) setValue("guardian", emptyGuardian as unknown as AthleteForm["guardian"]);
    if (!isMinor && getValues("guardian")) setValue("guardian", null);
  }, [isMinor, getValues, setValue]);

  /** Date of birth and gender always come from the NIC when there is one. */
  function applyNic(c: CheckedIdentity) {
    if (c.identity.type !== "nic") return;
    const r = parseNic(c.identity.nic);
    if (r.ok) {
      setValue("dateOfBirth", r.info.dateOfBirth);
      setValue("gender", r.info.gender);
    }
  }

  // Load the checked identity, and any answers already given in this tab.
  useEffect(() => {
    const c = loadCheckedIdentity();
    if (!c) {
      router.replace("/register/check");
      return;
    }
    const draft = loadDraft<AthleteForm, CoachUiState>(c.identity);
    if (draft) {
      reset({ ...DEFAULTS, ...draft.values });
      setCoachInitial(draft.coach);
      setCoachState(draft.coach);
      setRestored(true);
    }
    applyNic(c);
    setChecked(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, reset]);

  // Keep answers safe while typing (a reload or language change does not lose them).
  useEffect(() => {
    if (!checked) return;
    const timer = setTimeout(() => saveDraft(checked.identity, values, coachState), 400);
    return () => clearTimeout(timer);
  }, [checked, values, coachState]);

  function startOver() {
    clearDraft();
    reset(DEFAULTS);
    if (checked) applyNic(checked);
    setCoachInitial(undefined);
    setCoachState(undefined);
    setCoachKey((k) => k + 1);
    setRestored(false);
    setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- progress: how many required answers are given, per section ----------
  const progress: ProgressItem[] = useMemo(() => {
    const v = values as Record<string, unknown> & { events?: { code?: string }[]; guardian?: Record<string, unknown> | null };
    const mainCodes = (v.events ?? []).slice(0, MAIN_EVENTS).map((e) => e?.code).filter(Boolean);
    const g = v.guardian ?? {};
    const items: ProgressItem[] = [
      {
        id: "sec-about", label: t("aboutYou"), total: 7,
        done: [filled(v.fullName), filled(v.nameWithInitials), isDate(v.dateOfBirth), filled(v.gender),
          filled(v.district), phoneOk(v.phone), filled(v.schoolOrClub)].filter(Boolean).length,
      },
      { id: "sec-events", label: t("navEvents"), total: MAIN_EVENTS, done: new Set(mainCodes).size },
    ];
    if (isMinor) {
      items.push({
        id: "sec-guardian", label: t("navGuardian"), total: 4,
        done: [filled(g.fullName), filled(g.relationship), phoneOk(g.phone), g.consent === true].filter(Boolean).length,
      });
    }
    items.push(
      { id: "sec-coaches", label: t("navCoaches"), total: 2,
        done: Number(coachStatus.currentDone) + Number(coachStatus.pastAnswered) },
      { id: "sec-consent", label: t("consentSection"), total: 1, done: v.consent === true ? 1 : 0 },
    );
    return items;
  }, [values, isMinor, coachStatus, t]);

  const pct = percentComplete(progress);
  const statusOf = (id: string) => progress.find((p) => p.id === id);
  const unfinished = progress.filter((p) => p.done < p.total);

  /** After a failed submit: say which sections need attention and go to the first one. */
  function showProblems(fieldNames: string[]) {
    const ids = [...new Set(fieldNames.map((f) => SECTION_OF[f.split(".")[0]]).filter(Boolean))]
      .sort((a, b) => SECTION_ORDER.indexOf(a) - SECTION_ORDER.indexOf(b));
    if (!ids.length) return false;
    const labels = ids.map((id) => progress.find((p) => p.id === id)?.label ?? id);
    setFormError(t("fixErrors", { list: labels.join(", ") }));
    jumpTo(ids[0]);
    return true;
  }

  const coachesAnswered = coachStatus.currentDone && coachStatus.pastAnswered;

  function onInvalid(errs: FieldErrors<AthleteForm>) {
    setCoachAttempted(true);
    showProblems([...Object.keys(errs), ...(coachesAnswered ? [] : ["coaches"])]);
  }

  async function onSubmit(form: AthleteForm) {
    if (!checked) return;
    setFormError(null);
    setCoachAttempted(true);
    if (!coachesAnswered) {
      showProblems(["coaches"]);
      return;
    }
    const token = (await turnstile.current?.getToken()) ?? "";
    if (!token) {
      setFormError(t("securityNotLoaded"));
      return;
    }
    const result = await submitRegistration("/api/register/athlete", {
      identity: checked.identity,
      form,
      turnstileToken: token,
    });
    turnstile.current?.reset();
    if (result.ok) {
      saveDone({
        slaaId: result.slaaId,
        name: form.nameWithInitials,
        coachLinks: form.coaches.length + form.unlistedCoaches.length,
      });
      clearDraft();
      clearCheckedIdentity();
      router.push("/register/done");
      return;
    }
    for (const [field, message] of Object.entries(result.fields)) {
      if (field.split(".")[0] in athleteFormSchema.shape) setError(field as Path<AthleteForm>, { message });
    }
    if (!showProblems(Object.keys(result.fields))) setFormError(result.error);
  }

  if (!checked) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden /> {t("loading")}
      </p>
    );
  }
  const lockedFromNic = checked.identity.type === "nic";
  const g = errors.guardian as FieldErrors<NonNullable<AthleteForm["guardian"]>> & { message?: string } | undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-5 sm:gap-6" noValidate>
      <Stepper current={2} />
      <PageTitle title={t("formTitle")} intro={t("formIntro")} />

      {restored && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2">
            <History className="size-4 shrink-0 text-primary" aria-hidden />
            {t("draftRestored")}
          </span>
          <button type="button" onClick={startOver} className="font-medium text-primary underline-offset-4 hover:underline">
            {t("startOver")}
          </button>
        </div>
      )}

      <IdentitySummary identity={checked.identity} />
      <FormProgress items={progress} />

      <Section id="sec-about" title={t("aboutYou")} icon={<UserRound />} status={statusOf("sec-about")}>
        <PersonFields register={register} errors={errors} lockedFromNic={lockedFromNic}
          phoneLabel={t("phoneAthlete")} district={district} />
        <Field label={t("schoolOrClub")} htmlFor="schoolOrClub" error={errors.schoolOrClub?.message}>
          <Input id="schoolOrClub" className={inputClass} {...register("schoolOrClub")}
            aria-invalid={!!errors.schoolOrClub} />
        </Field>
      </Section>

      <Section id="sec-events" title={t("eventsTitle")} description={t("eventsDesc")} icon={<Trophy />}
        status={statusOf("sec-events")}>
        <Controller control={control} name="events"
          render={({ field }) => (
            <EventRows value={field.value} onChange={field.onChange}
              error={(errors.events as { message?: string; root?: { message?: string } } | undefined)?.message
                ?? (errors.events as { root?: { message?: string } } | undefined)?.root?.message}
              itemErrors={itemErrors(errors.events)} />
          )} />
      </Section>

      {isMinor && (
        <Section id="sec-guardian" title={t("guardianTitle")} description={t("guardianDesc")} icon={<ShieldCheck />}
          status={statusOf("sec-guardian")}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("guardianName")} htmlFor="g-name" error={g?.fullName?.message}>
              <Input id="g-name" className={inputClass} {...register("guardian.fullName")} />
            </Field>
            <Field label={t("guardianRel")} htmlFor="g-rel" error={g?.relationship?.message}
              hint={t("guardianRelHint")}>
              <Input id="g-rel" className={inputClass} {...register("guardian.relationship")} />
            </Field>
            <Field label={t("guardianPhone")} htmlFor="g-phone" error={g?.phone?.message}>
              <Input id="g-phone" type="tel" inputMode="tel" className={inputClass} {...register("guardian.phone")} />
            </Field>
            <Field label={t("guardianNic")} htmlFor="g-nic" optional error={g?.nic?.message}>
              <Input id="g-nic" className={inputClass + " font-mono uppercase"} {...register("guardian.nic")} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary"
              {...register("guardian.consent")} />
            <span>{t("guardianConsentCheckbox")}</span>
          </label>
          {g?.consent?.message && <p role="alert" className="text-sm text-destructive">{tErr(g.consent.message)}</p>}
          {g?.message && <p role="alert" className="text-sm text-destructive">{tErr(g.message)}</p>}
        </Section>
      )}

      <Section id="sec-coaches" title={t("coachesTitle")} description={t("coachesDesc")} icon={<Users />}
        status={statusOf("sec-coaches")}>
        <CoachSection
          key={coachKey}
          athleteDistrict={district || undefined}
          birthYear={isDate(dob) ? Number(dob.slice(0, 4)) : undefined}
          initialState={coachInitial}
          onChange={({ coaches, unlistedCoaches, state, status }) => {
            const opts = { shouldValidate: isSubmitted, shouldDirty: true };
            setValue("coaches", coaches as AthleteForm["coaches"], opts);
            setValue("unlistedCoaches", unlistedCoaches as AthleteForm["unlistedCoaches"], opts);
            setCoachState(state);
            setCoachStatus(status);
          }}
          coachErrors={itemErrors(errors.coaches)}
          unlistedErrors={itemErrors(errors.unlistedCoaches)}
          error={(errors.coaches as { message?: string } | undefined)?.message
            ?? (errors.unlistedCoaches as { message?: string } | undefined)?.message
            ?? (coachAttempted && !coachesAnswered ? COACH_QUESTIONS_MSG : undefined)} />
      </Section>

      <Section id="sec-consent" title={t("consentSection")} icon={<FileCheck />} status={statusOf("sec-consent")}>
        <ConsentBlock register={register} error={errors.consent?.message} />
      </Section>

      <FormError message={formError} />
      <Turnstile ref={turnstile} />
      <StickyActions>
        {/* what is still missing, right above the button */}
        <div className="mb-2.5 text-sm" aria-live="polite">
          {pct === 100 ? (
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <PartyPopper className="size-4 shrink-0" aria-hidden /> {t("allSet")}
            </p>
          ) : (
            <p className="text-muted-foreground">
              {t("stillToFinish", { list: "" })}
              {unfinished.map((u, i) => (
                <span key={u.id}>
                  {i > 0 && ", "}
                  <button type="button" onClick={() => jumpTo(u.id)}
                    className="font-medium text-amber-800 underline decoration-amber-400 underline-offset-2">
                    {u.label}
                  </button>
                </span>
              ))}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting}
          className={cn("h-auto min-h-12 w-full gap-2 rounded-xl py-2 text-base whitespace-normal sm:min-h-13 sm:text-lg",
            pct === 100 && "bg-emerald-600 hover:bg-emerald-600/90")}>
          {isSubmitting && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </StickyActions>
    </form>
  );
}
