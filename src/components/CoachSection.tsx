"use client";

import { LoaderCircle, MapPin, Plus, Search, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PHONE_REGEX, cleanPhone, todayInColombo } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { DistrictSelect } from "./DistrictSelect";
import { Field, inputClass, selectClass } from "./Field";
import { useT } from "./LangProvider";

// The coach part of the athlete form, as two plain questions:
//   1. Who coaches you now?      (the first one is the main coach)
//   2. Did anyone coach you before?  Yes / No
// One search box per question. It suggests coaches from the athlete's own
// district, and if the coach is not registered the last option is always
// "Add <name> as a new coach", so there is no separate form to find.
//
// The form itself still stores two lists: `coaches` (registered, by SLAA ID)
// and `unlistedCoaches` (typed in, sent to SLAA staff to follow up).

export type CoachLink = {
  coachId: string;
  relationship: "CURRENT" | "PAST";
  startYear: string | number;
  endYear: string | number;
  isPrimary: boolean;
};

export type UnlistedCoachRow = {
  name: string;
  phone: string;
  district: string;
  relationship: "CURRENT" | "PAST";
  startYear: string | number;
  endYear: string | number;
};

type Result = { slaaId: string; name: string; district: string };

export type Entry =
  | { kind: "listed"; key: string; coachId: string; name: string; district: string; startYear: string; endYear: string }
  | { kind: "new"; key: string; name: string; phone: string; district: string; startYear: string; endYear: string };

const MAX_CURRENT = 3;
const MAX_PAST = 5;
const MAX_NEW = 5; // matches unlistedCoachSchema

// random, so keys from saved answers never clash with new ones
const newKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Everything on screen, so the form can save it and put it back after a reload. */
export type CoachUiState = { current: Entry[]; past: Entry[]; noCurrent: boolean; hadPast: boolean | null };

/** For the progress bar: has the athlete answered both questions? */
export type CoachStatus = { currentDone: boolean; pastAnswered: boolean };

type ItemErrors = Record<number, Record<string, string>>;

export function CoachSection({
  athleteDistrict,
  birthYear,
  initialState,
  onChange,
  coachErrors,
  unlistedErrors,
  error,
}: {
  athleteDistrict?: string;
  birthYear?: number;
  initialState?: CoachUiState;
  onChange: (v: {
    coaches: CoachLink[];
    unlistedCoaches: UnlistedCoachRow[];
    state: CoachUiState;
    status: CoachStatus;
  }) => void;
  coachErrors?: ItemErrors;
  unlistedErrors?: ItemErrors;
  error?: string;
}) {
  const { t, tErr } = useT();
  const [current, setCurrent] = useState<Entry[]>(initialState?.current ?? []);
  const [past, setPast] = useState<Entry[]>(initialState?.past ?? []);
  const [noCurrent, setNoCurrent] = useState(initialState?.noCurrent ?? false);
  const [hadPast, setHadPast] = useState<boolean | null>(initialState?.hadPast ?? null);
  const [addingCurrent, setAddingCurrent] = useState(false);
  const [addingPast, setAddingPast] = useState(false);

  // keep the form's two lists in step with what is on screen
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    const rows = [
      ...current.map((e, i) => ({ e, rel: "CURRENT" as const, primary: i === 0 })),
      ...(hadPast ? past.map((e) => ({ e, rel: "PAST" as const, primary: false })) : []),
    ];
    onChangeRef.current({
      coaches: rows.flatMap(({ e, rel, primary }) =>
        e.kind === "listed"
          ? [{ coachId: e.coachId, relationship: rel, startYear: e.startYear,
               endYear: rel === "CURRENT" ? "" : e.endYear, isPrimary: primary }]
          : []),
      unlistedCoaches: rows.flatMap(({ e, rel }) =>
        e.kind === "new"
          ? [{ name: e.name, phone: e.phone, district: e.district, relationship: rel,
               startYear: e.startYear, endYear: rel === "CURRENT" ? "" : e.endYear }]
          : []),
      state: { current, past, noCurrent, hadPast },
      status: {
        currentDone:
          noCurrent ||
          (current.length > 0 &&
            current.every(
              (e) => e.kind === "listed" || !cleanPhone(e.phone) || PHONE_REGEX.test(cleanPhone(e.phone)),
            )),
        pastAnswered: hadPast === false || (hadPast === true && past.length > 0),
      },
    });
  }, [current, past, hadPast, noCurrent]);

  // map server/validation errors (per list) back onto the cards on screen
  const errorsFor = useMemo(() => {
    const out = new Map<string, Record<string, string>>();
    let li = 0, ni = 0;
    for (const e of [...current, ...(hadPast ? past : [])]) {
      const errs = e.kind === "listed" ? coachErrors?.[li++] : unlistedErrors?.[ni++];
      if (errs) out.set(e.key, errs);
    }
    return out;
  }, [current, past, hadPast, coachErrors, unlistedErrors]);

  const newCount = [...current, ...past].filter((e) => e.kind === "new").length;
  const chosenIds = (list: Entry[]) => new Set(list.flatMap((e) => (e.kind === "listed" ? [e.coachId] : [])));

  const years = useMemo(() => {
    const now = Number(todayInColombo().slice(0, 4));
    const from = Math.max(1950, birthYear ? birthYear + 3 : 1950);
    return Array.from({ length: Math.max(1, now - from + 1) }, (_, i) => String(now - i));
  }, [birthYear]);

  function pick(list: "current" | "past", r: Result | { newName: string }) {
    const entry: Entry =
      "newName" in r
        ? { kind: "new", key: newKey(), name: r.newName, phone: "", district: athleteDistrict ?? "", startYear: "", endYear: "" }
        : { kind: "listed", key: newKey(), coachId: r.slaaId, name: r.name, district: r.district, startYear: "", endYear: "" };
    if (list === "current") {
      setCurrent((c) => [...c, entry]);
      setAddingCurrent(false);
    } else {
      setPast((p) => [...p, entry]);
      setAddingPast(false);
    }
  }

  const patch = (list: "current" | "past", key: string, p: Partial<Entry>) =>
    (list === "current" ? setCurrent : setPast)((l) => l.map((e) => (e.key === key ? ({ ...e, ...p } as Entry) : e)));
  const remove = (list: "current" | "past", key: string) =>
    (list === "current" ? setCurrent : setPast)((l) => l.filter((e) => e.key !== key));

  const showCurrentFinder = !noCurrent && (current.length === 0 || addingCurrent);
  const showPastFinder = hadPast === true && (past.length === 0 || addingPast);

  return (
    <div className="flex flex-col gap-7">
      {/* 1. Who coaches you now? */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="font-semibold">{t("coachNowTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("coachNowHint")}</p>
        </div>

        {current.map((e, i) => (
          <CoachCard key={e.key} entry={e} relationship="CURRENT" years={years}
            badge={i === 0 ? t("mainCoach") : t("alsoCoaching")} errors={errorsFor.get(e.key)}
            onPatch={(p) => patch("current", e.key, p)} onRemove={() => remove("current", e.key)} />
        ))}

        {noCurrent ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
            <span>{t("noCoachNowSet")}</span>
            <button type="button" className="shrink-0 font-medium text-primary" onClick={() => setNoCurrent(false)}>
              {t("change")}
            </button>
          </div>
        ) : showCurrentFinder ? (
          <>
            <CoachFinder id="finder-current" near={athleteDistrict} exclude={chosenIds(current)}
              allowNew={newCount < MAX_NEW} onPick={(r) => pick("current", r)}
              onCancel={current.length > 0 ? () => setAddingCurrent(false) : undefined} />
            {current.length === 0 && (
              <button type="button" onClick={() => setNoCurrent(true)}
                className="self-start text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
                {t("noCoachNow")}
              </button>
            )}
          </>
        ) : (
          current.length < MAX_CURRENT && (
            <AddButton onClick={() => setAddingCurrent(true)}>{t("addAnotherCurrent")}</AddButton>
          )
        )}
      </div>

      {/* 2. Did anyone coach you before? */}
      <div className="flex flex-col gap-3 border-t pt-6">
        <h3 id="past-q" className="font-semibold">{t("pastQuestion")}</h3>
        <div role="radiogroup" aria-labelledby="past-q" className="grid max-w-xs grid-cols-2 gap-2">
          {([true, false] as const).map((v) => (
            <button key={String(v)} type="button" role="radio" aria-checked={hadPast === v}
              onClick={() => setHadPast(v)}
              className={cn("min-h-11 rounded-xl border-2 px-4 text-sm font-medium transition-colors",
                hadPast === v ? "border-primary bg-primary/5 text-primary" : "border-border bg-background hover:bg-muted")}>
              {v ? t("yes") : t("no")}
            </button>
          ))}
        </div>

        {hadPast && (
          <>
            {past.map((e) => (
              <CoachCard key={e.key} entry={e} relationship="PAST" years={years} errors={errorsFor.get(e.key)}
                onPatch={(p) => patch("past", e.key, p)} onRemove={() => remove("past", e.key)} />
            ))}
            {showPastFinder ? (
              <CoachFinder id="finder-past" near={athleteDistrict} exclude={chosenIds(past)}
                allowNew={newCount < MAX_NEW} onPick={(r) => pick("past", r)}
                onCancel={past.length > 0 ? () => setAddingPast(false) : undefined} />
            ) : (
              past.length < MAX_PAST && <AddButton onClick={() => setAddingPast(true)}>{t("addPastCoach")}</AddButton>
            )}
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t("coachPrivacy")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{tErr(error)}</p>}
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}
      className="h-auto min-h-11 gap-2 self-start rounded-xl px-4 whitespace-normal">
      <Plus className="size-4" aria-hidden />
      {children}
    </Button>
  );
}

function initials(name: string) {
  const words = name.replace(/[.]/g, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?";
}

/** Search box with suggestions from the athlete's district and an "add as new coach" fallback. */
function CoachFinder({
  id,
  near,
  exclude,
  allowNew,
  onPick,
  onCancel,
}: {
  id: string;
  near?: string;
  exclude: Set<string>;
  allowNew: boolean;
  onPick: (r: Result | { newName: string }) => void;
  onCancel?: () => void;
}) {
  const { t, tErr, district } = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [searchError, setSearchError] = useState("");
  const seq = useRef(0);
  const text = q.trim();
  const suggesting = text.length === 0 && !!near;

  useEffect(() => {
    if (text.length === 1 || (text.length === 0 && !near)) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const mine = ++seq.current;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams(text ? { q: text } : {});
        if (near) params.set("near", near);
        const res = await fetch(`/api/coaches/search?${params}`);
        const body = await res.json().catch(() => ({}));
        if (mine !== seq.current) return;
        if (!res.ok) {
          setSearchError(body.error ?? t("searchFailed"));
          setStatus("error");
          return;
        }
        setResults(body.results);
        setStatus("idle");
      } catch {
        if (mine === seq.current) {
          setSearchError(t("searchNetwork"));
          setStatus("error");
        }
      }
    }, text ? 300 : 0);
    return () => clearTimeout(timer);
  }, [text, near, t]);

  function choose(r: Result | { newName: string }) {
    onPick(r);
    setQ("");
  }

  const showNew = text.length >= 2 && allowNew;
  const listId = `${id}-list`;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed bg-muted/30 p-3 sm:p-4">
      <label htmlFor={id} className="sr-only">{t("finderLabel")}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id={id} role="combobox" aria-expanded={results.length > 0 || showNew} aria-controls={listId}
            aria-label={t("finderLabel")} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("finderPlaceholder")} className={cn(inputClass, "bg-background pl-9")} />
          {status === "loading" && (
            <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          )}
        </div>
        {onCancel && (
          <Button type="button" variant="ghost" className="h-12 rounded-xl px-3" onClick={onCancel} aria-label={t("remove")}>
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>

      {status === "error" && <p className="text-sm text-destructive">{tErr(searchError)}</p>}

      {(results.length > 0 || showNew) && (
        <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
          {suggesting && results.length > 0 && (
            <p className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {t("suggestedNear", { district: district(near!) })}
            </p>
          )}
          <ul id={listId} role="listbox" aria-label={t("finderLabel")} className="max-h-72 divide-y overflow-y-auto">
            {results.map((r) => {
              const taken = exclude.has(r.slaaId);
              return (
                <li key={r.slaaId} role="option" aria-selected={false} aria-disabled={taken}>
                  <button type="button" disabled={taken} onClick={() => choose(r)}
                    className={cn("flex w-full min-h-14 items-center gap-3 px-3 py-2 text-left",
                      taken ? "opacity-45" : "hover:bg-primary/5 active:bg-primary/10")}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(r.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {district(r.district)} · <span className="font-mono">{r.slaaId}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {showNew && (
              <li role="option" aria-selected={false}>
                <button type="button" onClick={() => choose({ newName: text })}
                  className="flex w-full min-h-14 items-center gap-3 bg-amber-50/60 px-3 py-2 text-left hover:bg-amber-50 active:bg-amber-100">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800">
                    <UserPlus className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t("addAsNew", { name: text })}</span>
                    <span className="block text-xs text-muted-foreground">{t("addAsNewHint")}</span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A chosen coach: who, and when. New (unregistered) coaches also ask for a phone number. */
function CoachCard({
  entry,
  relationship,
  years,
  badge,
  errors = {},
  onPatch,
  onRemove,
}: {
  entry: Entry;
  relationship: "CURRENT" | "PAST";
  years: string[];
  badge?: string;
  errors?: Record<string, string>;
  onPatch: (p: Partial<Entry>) => void;
  onRemove: () => void;
}) {
  const { t, district } = useT();
  const isNew = entry.kind === "new";
  const k = entry.key;

  const yearSelect = (field: "startYear" | "endYear", label: string, min?: string) => (
    <Field label={label} htmlFor={`${k}-${field}`} error={errors[field]}>
      <select id={`${k}-${field}`} className={selectClass} value={entry[field]}
        onChange={(e) => onPatch({ [field]: e.target.value } as Partial<Entry>)}>
        <option value="">{t("notSure")}</option>
        {years.filter((y) => !min || y >= min).map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </Field>
  );

  return (
    <div data-testid="coach-card" data-kind={entry.kind}
      className={cn("flex flex-col gap-3 rounded-xl border p-3 sm:p-4",
        isNew ? "border-amber-300 bg-amber-50/50" : "border-primary/25 bg-primary/[0.03]")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold",
            isNew ? "bg-amber-100 text-amber-800" : "bg-primary text-primary-foreground")}>
            {initials(entry.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="truncate font-semibold">{entry.name}</p>
              {badge && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{badge}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {isNew ? (
                <span className="text-amber-800">{t("newCoachBadge")}</span>
              ) : (
                <>{district(entry.district)} · <span className="font-mono">{entry.coachId}</span></>
              )}
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 gap-1 text-muted-foreground" onClick={onRemove}>
          <X className="size-4" aria-hidden />
          <span className="hidden sm:inline">{t("remove")}</span>
          <span className="sr-only sm:hidden">{t("remove")}</span>
        </Button>
      </div>

      {isNew && (
        <div className="flex flex-col gap-3 rounded-lg bg-background/70 p-3">
          <p className="text-xs text-muted-foreground">
            {t("newCoachPhoneOptional", { name: entry.name })}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("unlistedPhone")} htmlFor={`${k}-phone`} optional error={errors.phone}>
              <Input id={`${k}-phone`} type="tel" inputMode="tel" className={inputClass} value={entry.phone}
                aria-invalid={!!errors.phone} onChange={(e) => onPatch({ phone: e.target.value })} />
            </Field>
            <Field label={t("district")} htmlFor={`${k}-district`} optional>
              <DistrictSelect id={`${k}-district`} value={entry.district} onChange={(e) => onPatch({ district: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {relationship === "CURRENT" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{yearSelect("startYear", t("coachingSince"))}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {yearSelect("startYear", t("fromYear"))}
          {yearSelect("endYear", t("toYear"), entry.startYear || undefined)}
        </div>
      )}
    </div>
  );
}
