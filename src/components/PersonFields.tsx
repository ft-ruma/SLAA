"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { DistrictSelect } from "./DistrictSelect";
import { Field, inputClass, selectClass } from "./Field";
import { useT } from "./LangProvider";

type PersonValues = {
  fullName: string;
  nameWithInitials: string;
  dateOfBirth: string;
  gender: "M" | "F";
  district: string;
  phone: string;
  consent: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Props = {
  register: UseFormRegister<any>;
  errors: FieldErrors<PersonValues>;
  /** DOB and gender come from the NIC and cannot be changed. */
  lockedFromNic: boolean;
  phoneLabel: string;
  /** current district value, to show its province */
  district?: string;
};

export function PersonFields({ register, errors, lockedFromNic, phoneLabel, district }: Props) {
  const { t, province } = useT();
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("fullName")} htmlFor="fullName" error={errors.fullName?.message} hint={t("fullNameHint")}>
          <Input id="fullName" className={inputClass} autoComplete="name" {...register("fullName")}
            aria-invalid={!!errors.fullName} />
        </Field>
        <Field label={t("nameWithInitials")} htmlFor="nameWithInitials" error={errors.nameWithInitials?.message}
          hint={t("nameWithInitialsHint")}>
          <Input id="nameWithInitials" className={inputClass} {...register("nameWithInitials")}
            aria-invalid={!!errors.nameWithInitials} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("dateOfBirth")} htmlFor="dateOfBirth" error={errors.dateOfBirth?.message}
          hint={lockedFromNic ? t("fromNic") : undefined}>
          <Input id="dateOfBirth" type="date" className={inputClass} readOnly={lockedFromNic}
            {...register("dateOfBirth")} aria-invalid={!!errors.dateOfBirth} />
        </Field>
        <Field label={t("gender")} htmlFor="gender" error={errors.gender?.message}
          hint={lockedFromNic ? t("fromNic") : undefined}>
          {/* a disabled select is not submitted, so lock it with pointer-events instead */}
          <select id="gender" className={selectClass} {...register("gender")}
            aria-readonly={lockedFromNic} tabIndex={lockedFromNic ? -1 : undefined}
            style={lockedFromNic ? { pointerEvents: "none", opacity: 0.7 } : undefined}
            aria-invalid={!!errors.gender}>
            <option value="">{t("select")}</option>
            <option value="M">{t("male")}</option>
            <option value="F">{t("female")}</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("district")} htmlFor="district" error={errors.district?.message}
          hint={district ? <span data-testid="province">{t("province")}: {province(district)}</span> : undefined}>
          <DistrictSelect id="district" {...register("district")} aria-invalid={!!errors.district} />
        </Field>
        <Field label={phoneLabel} htmlFor="phone" error={errors.phone?.message} hint={t("phoneHint")}>
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" className={inputClass}
            {...register("phone")} aria-invalid={!!errors.phone} />
        </Field>
      </div>
    </>
  );
}

export function ConsentBlock({ register, error, name = "consent" }: {
  register: UseFormRegister<any>;
  error?: string;
  name?: string;
}) {
  const { t, tErr } = useT();
  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-56 overflow-y-auto rounded-xl bg-muted p-4 text-sm leading-relaxed text-muted-foreground sm:max-h-none">
        <p className="mb-1 font-medium text-foreground">{t("consentTitle")}</p>
        {t("consentBody")}
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/40 p-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" {...register(name)}
          aria-invalid={!!error} />
        <span>{t("consentCheckbox")}</span>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{tErr(error)}</p>}
    </div>
  );
}
