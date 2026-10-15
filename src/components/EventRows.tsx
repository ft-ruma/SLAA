"use client";

import { Plus, Timer, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENTS, pbKind } from "@/lib/reference";
import { cn } from "@/lib/utils";
import { Field, inputClass, selectClass } from "./Field";
import { useT } from "./LangProvider";

export type EventRow = { code: string; pb: string; pbYear: string | number; pbCompetition: string };

export const MAIN_EVENTS = 1;
export const MAX_EVENTS = 8;

export const emptyEventRow: EventRow = { code: "", pb: "", pbYear: "", pbCompetition: "" };

const GROUPS = [...new Set(EVENTS.map((e) => e.category))];
const PB_HINT = { time: "pbHintTime", distance: "pbHintDistance", points: "pbHintPoints" } as const;

/**
 * One required main event, then optional additional ones. Each row has
 * the event and, if the athlete has one, the personal best with its year
 * and competition.
 */
export function EventRows({
  value,
  onChange,
  error,
  itemErrors,
}: {
  value: EventRow[];
  onChange: (v: EventRow[]) => void;
  error?: string;
  itemErrors?: Record<number, Record<string, string>>;
}) {
  const { t, tErr, event, category } = useT();
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const update = (i: number, patch: Partial<EventRow>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="flex flex-col gap-3">
      {value.map((row, i) => {
        const errs = itemErrors?.[i] ?? {};
        const isMain = i < MAIN_EVENTS;
        const takenElsewhere = new Set(value.filter((_, j) => j !== i).map((r) => r.code));
        // personal best fields stay folded away until wanted (or already filled / in error)
        const pbOpen = opened.has(i) || !!(row.pb || row.pbYear || row.pbCompetition)
          || !!(errs.pb || errs.pbYear || errs.pbCompetition);
        return (
          <div key={i} data-testid="event-row" role="group" aria-labelledby={`eventhead-${i}`}
            className={cn("flex flex-col gap-3 rounded-xl border p-3 sm:p-4", isMain ? "bg-background" : "bg-muted/30")}>
            <div className="flex items-center justify-between gap-2">
              <span id={`eventhead-${i}`} className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">{i + 1}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                  isMain ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {isMain ? t("mainBadge") : t("extraBadge")}
                </span>
              </span>
              {!isMain && (
                <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}>
                  <X className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{t("remove")}</span>
                  <span className="sr-only sm:hidden">{t("remove")}</span>
                </Button>
              )}
            </div>

            <div className={cn("grid gap-3", pbOpen && "md:grid-cols-[1.3fr_1fr_0.7fr]")}>
              <Field label={t("eventN", { n: String(i + 1) })} htmlFor={`event-${i}`} error={errs.code}>
                <select id={`event-${i}`} className={selectClass} value={row.code} aria-invalid={!!errs.code}
                  onChange={(e) => update(i, { code: e.target.value })}>
                  <option value="">{t("selectEvent")}</option>
                  {GROUPS.map((g) => (
                    <optgroup key={g} label={category(g)}>
                      {EVENTS.filter((e) => e.category === g).map((e) => (
                        <option key={e.code} value={e.code} disabled={takenElsewhere.has(e.code)}>
                          {event(e.code)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              {pbOpen && (
              <div className="grid grid-cols-[1.4fr_1fr] gap-3 md:contents">
              <Field label={t("personalBest")} htmlFor={`pb-${i}`} optional error={errs.pb}
                hint={t(PB_HINT[row.code ? pbKind(row.code) : "time"])}>
                <Input id={`pb-${i}`} inputMode="decimal" maxLength={10} className={cn(inputClass, "font-mono")}
                  value={row.pb} aria-invalid={!!errs.pb} onChange={(e) => update(i, { pb: e.target.value })} />
              </Field>
              <Field label={t("pbYear")} htmlFor={`pbyear-${i}`} optional error={errs.pbYear}>
                <Input id={`pbyear-${i}`} inputMode="numeric" maxLength={4} className={inputClass}
                  value={String(row.pbYear)} aria-invalid={!!errs.pbYear}
                  onChange={(e) => update(i, { pbYear: e.target.value })} />
              </Field>
              </div>
              )}
            </div>
            {pbOpen ? (
              <Field label={t("pbCompetition")} htmlFor={`pbcomp-${i}`} optional error={errs.pbCompetition}>
                <Input id={`pbcomp-${i}`} maxLength={120} className={inputClass} value={row.pbCompetition}
                  onChange={(e) => update(i, { pbCompetition: e.target.value })} />
              </Field>
            ) : (
              <button type="button" onClick={() => setOpened((s) => new Set(s).add(i))}
                className="flex min-h-10 items-start gap-1.5 self-start rounded-lg px-1 py-2 text-left text-sm font-medium text-primary hover:underline">
                <Timer className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t("addPb")} <span className="font-normal text-muted-foreground">{t("optional")}</span></span>
              </button>
            )}
          </div>
        );
      })}

      {value.length < MAX_EVENTS && (
        <Button type="button" variant="outline" className="h-auto min-h-12 gap-2 self-start rounded-xl px-4 whitespace-normal"
          onClick={() => onChange([...value, emptyEventRow])}>
          <Plus className="size-4" aria-hidden />
          {t("addEvent")}
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{tErr(error)}</p>}
    </div>
  );
}
