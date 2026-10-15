"use client";

import { CircleCheck, IdCard, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { parseNic } from "@/lib/nic";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/i18n";
import { Field, inputClass } from "./Field";
import { useT } from "./LangProvider";

export type IdentityType = "nic" | "postal";
export type IdentityValues = {
  type: IdentityType;
  nic: string;
  postalId: string;
};

export const emptyIdentity: IdentityValues = {
  type: "nic",
  nic: "",
  postalId: "",
};

const TYPE_LABELS = { nic: "idNic", postal: "idPostal" } as const;
const TYPE_ICONS = { nic: IdCard, postal: Mail } as const;

export function IdentityFields({
  value,
  onChange,
  errors,
}: {
  value: IdentityValues;
  onChange: (v: IdentityValues) => void;
  errors: Record<string, string>;
}) {
  const { t, tErr, lang } = useT();
  const types: IdentityType[] = ["nic", "postal"];
  const set = (patch: Partial<IdentityValues>) => onChange({ ...value, ...patch });
  const nic = value.nic.trim() ? parseNic(value.nic) : null;

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t("whichId")}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {types.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={value.type === type}
              onClick={() => set({ type })}
              className={cn(
                "flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors sm:text-base",
                value.type === type
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {(() => {
                const Icon = TYPE_ICONS[type];
                return <Icon className="size-5 shrink-0" aria-hidden />;
              })()}
              <span className="text-balance">{t(TYPE_LABELS[type])}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {value.type === "nic" && (
        <Field label={t("nicNumber")} htmlFor="nic" error={errors.nic} hint={t("nicHint")}>
          <Input
            id="nic"
            className={cn(inputClass, "h-14 font-mono text-lg uppercase tracking-widest")}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={14}
            value={value.nic}
            onChange={(e) => set({ nic: e.target.value })}
            aria-invalid={!!errors.nic || (nic !== null && !nic.ok && value.nic.replace(/\s/g, "").length >= 10)}
          />
          {nic?.ok && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950" data-testid="nic-decoded">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
              {withBold(t("nicDecoded"), {
                dob: formatDate(lang, nic.info.dateOfBirth),
                gender: t(nic.info.gender === "F" ? "genderFemaleLower" : "genderMaleLower"),
              })}
              </span>
            </div>
          )}
          {nic && !nic.ok && value.nic.replace(/\s/g, "").length >= 10 && !errors.nic && (
            <p className="text-sm text-destructive">{tErr(nic.error)}</p>
          )}
        </Field>
      )}

      {value.type === "postal" && (
        <Field label={t("postalNumber")} htmlFor="postalId" error={errors.postalId}>
          <Input
            id="postalId"
            className={cn(inputClass, "h-14 font-mono text-lg uppercase tracking-wider")}
            autoComplete="off"
            value={value.postalId}
            onChange={(e) => set({ postalId: e.target.value })}
            aria-invalid={!!errors.postalId}
          />
        </Field>
      )}
    </div>
  );
}

/** Fill {name} placeholders with bold values, e.g. the decoded birth date. */
function withBold(template: string, values: Record<string, string>) {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1];
    return key && key in values ? <strong key={i}>{values[key]}</strong> : part;
  });
}

/** Reduce the form state to the shape identitySchema expects. */
export function toIdentity(v: IdentityValues) {
  switch (v.type) {
    case "nic":
      return { type: "nic" as const, nic: v.nic };
    case "postal":
      return { type: "postal" as const, postalId: v.postalId };
  }
}
