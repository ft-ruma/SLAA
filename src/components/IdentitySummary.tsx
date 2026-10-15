"use client";

import Link from "next/link";
import type { Identity } from "@/lib/validation";
import { useT } from "./LangProvider";

/** Locked identity from step 1. The person who typed it may see it again. */
export function IdentitySummary({ identity }: { identity: Identity }) {
  const { t } = useT();
  const [label, value] =
    identity.type === "nic"
      ? [t("idNic"), identity.nic.toUpperCase()]
      : [t("idPostal"), identity.postalId.toUpperCase()];

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background px-4 py-3 text-sm shadow-xs">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-mono font-medium">{value}</span>
      </div>
      <Link href="/register/check" className="shrink-0 rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/5">
        {t("change")}
      </Link>
    </div>
  );
}
