"use client";

import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "./LangProvider";

// Label + control + hint/error, sized for thumbs on small phones.

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const { t, tErr } = useT();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">{t("optional")}</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {tErr(error)}
        </p>
      )}
    </div>
  );
}

export const inputClass = "h-12 rounded-xl px-3 text-base";

export const selectClass =
  "h-12 w-full rounded-xl border border-input bg-background px-3 text-base outline-none " +
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 " +
  "aria-invalid:border-destructive disabled:opacity-60";

export function FormError({ message }: { message?: string | null }) {
  const { tErr } = useT();
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{tErr(message)}</span>
    </div>
  );
}

export type SectionStatus = { done: number; total: number };

export function Section({ id, title, description, icon, status, children }: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** shows "Done" or "N to go" next to the title */
  status?: SectionStatus;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const complete = status && status.done >= status.total;
  return (
    <section id={id}
      className={cn("form-anchor flex flex-col gap-5 rounded-2xl border bg-background p-4 shadow-xs transition-colors sm:p-6",
        complete && "border-emerald-200")}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl [&_svg]:size-5",
            complete ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary")}>
            {complete ? <Check aria-hidden /> : icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            {status && (
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold",
                complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
                {complete ? `✓ ${t("sectionDone")}` : t("sectionLeft", { n: String(status.total - status.done) })}
              </span>
            )}
          </div>
          {description && <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
