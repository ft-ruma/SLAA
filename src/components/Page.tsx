"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "./LangProvider";

// Layout pieces shared by the public pages.

/** Centred page column. Forms read best narrow; admin tables need width. */
export function PageContainer({
  size = "form",
  className,
  children,
}: {
  size?: "form" | "wide";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 sm:py-10",
        size === "form" ? "max-w-3xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Three-step progress bar: Check ID -> Details -> SLAA ID. */
export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useT();
  const steps = [t("stepLabelId"), t("stepLabelDetails"), t("stepLabelDone")];
  return (
    <nav aria-label={t("progress")} className="no-print">
      <p className="mb-2 text-xs font-medium text-muted-foreground sm:hidden">
        {t("stepOf", { n: String(current) })} · {steps[current - 1]}
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={label} className={cn("flex items-center gap-2", n < 3 && "flex-1")} aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                  !done && !active && "border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : n}
              </span>
              <span className={cn("hidden text-sm whitespace-nowrap sm:inline", active ? "font-semibold" : "text-muted-foreground")}>
                {label}
              </span>
              {n < 3 && <span className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Page title block under the progress bar. */
export function PageTitle({ title, intro }: { title: string; intro?: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 text-sm text-muted-foreground text-pretty sm:text-base">{intro}</p>}
    </div>
  );
}

/**
 * The main action button area. On phones it sticks to the bottom of the
 * screen (above the iPhone home bar) so it is always within thumb reach;
 * on tablets and up it sits in the page normally.
 */
export function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 pt-3 backdrop-blur",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        "sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
      )}
    >
      {children}
    </div>
  );
}
