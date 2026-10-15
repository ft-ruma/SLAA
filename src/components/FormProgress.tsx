"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionStatus } from "./Field";
import { useT } from "./LangProvider";

export type ProgressItem = SectionStatus & { id: string; label: string };

/** Overall percentage of the required answers given, out of all required answers. */
export function percentComplete(items: ProgressItem[]) {
  const total = items.reduce((n, i) => n + i.total, 0);
  const done = items.reduce((n, i) => n + Math.min(i.done, i.total), 0);
  return total ? Math.round((done / total) * 100) : 0;
}

export function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // move keyboard focus to the first thing to fill in that section
  const field = el.querySelector<HTMLElement>("input:not([type=hidden]):not([readonly]), select, button[role=combobox], [role=combobox]");
  setTimeout(() => field?.focus({ preventScroll: true }), 400);
}

/**
 * Sticky bar under the header: percentage, a progress bar, and one chip per
 * section (tick when done). Tapping a chip jumps to that section.
 */
export function FormProgress({ items }: { items: ProgressItem[] }) {
  const { t } = useT();
  const pct = percentComplete(items);
  const complete = pct === 100;

  return (
    <div className="no-print sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur sm:top-16 sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:py-3 sm:shadow-sm">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("yourProgress")}</span>
        <span className={cn("font-semibold tabular-nums", complete ? "text-emerald-700" : "text-primary")} aria-live="polite">
          {t("progressComplete", { n: String(pct) })}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted sm:mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={pct} aria-label={t("yourProgress")}>
        <div className={cn("h-full rounded-full transition-[width] duration-500", complete ? "bg-emerald-500" : "bg-primary")}
          style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-2.5 -mx-1 hidden gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] sm:flex">
        {items.map((i) => {
          const done = i.done >= i.total;
          return (
            <li key={i.id} className="shrink-0">
              <button type="button" onClick={() => jumpTo(i.id)}
                className={cn("flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-background text-muted-foreground hover:text-foreground")}>
                {done ? <Check className="size-3.5" aria-hidden /> : <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />}
                {i.label}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
