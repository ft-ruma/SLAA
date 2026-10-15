// Zod schemas shared by the forms (client) and the API routes (server).
// Schemas validate what the user typed; normalise*() turns it into what is
// stored. The database still enforces uniqueness and the NIC checks.

import { z } from "zod";
import { cleanNic, parseNic } from "./nic";
import { DISTRICTS, EVENT_CODES, PB_REGEX } from "./reference";
import { isValidSlaaId } from "./slaa-id";

export const PHONE_REGEX = /^(?:\+94|0)7[0-9]{8}$/;

export function cleanPhone(v: string) {
  return (v ?? "").replace(/[\s-]/g, "");
}

/** Store phones as +947XXXXXXXX so SMS sending needs no further work. */
export function normalizePhone(v: string) {
  const p = cleanPhone(v);
  return p.startsWith("0") ? "+94" + p.slice(1) : p;
}

export function normalizePostalId(v: string) {
  return (v ?? "").replace(/\s/g, "").toUpperCase();
}

export function cleanText(v: string) {
  return (v ?? "").trim().replace(/\s+/g, " ");
}

/** Age in whole years on the given date (default: today in Sri Lanka). */
export function ageOn(dob: string, on: string = todayInColombo()): number {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age;
}

export function todayInColombo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

const nicField = z.string().refine((v) => parseNic(v).ok, {
  error: (iss) => {
    const r = parseNic(String(iss.input ?? ""));
    return r.ok ? "Invalid NIC" : r.error;
  },
});

export const identitySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("nic"), nic: nicField }),
  z.object({
    type: z.literal("postal"),
    postalId: z
      .string()
      .refine((v) => /^[A-Z0-9/-]{4,20}$/.test(normalizePostalId(v)), {
        error: "Enter the Postal ID number (4-20 letters or digits).",
      }),
  }),
]);

export type Identity = z.infer<typeof identitySchema>;

export type NormalizedIdentity = {
  /** As entered (cleaned); the DB trigger normalises to 12-digit form. */
  nic: string | null;
  postalId: string | null;
};

export function normalizeIdentity(id: Identity): NormalizedIdentity {
  return {
    nic: id.type === "nic" ? cleanNic(id.nic) : null,
    postalId: id.type === "postal" ? normalizePostalId(id.postalId) : null,
  };
}

// ---------------------------------------------------------------------------
// Shared person fields
// ---------------------------------------------------------------------------

const requiredText = (label: string, max = 120) =>
  z
    .string()
    .refine((v) => cleanText(v).length > 0, { error: `${label} is required.` })
    .refine((v) => cleanText(v).length <= max, { error: `${label} is too long.` });

const phoneField = z.string().refine((v) => PHONE_REGEX.test(cleanPhone(v)), {
  error: "Enter a Sri Lankan mobile number, e.g. 0771234567.",
});

const dobField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Enter the date of birth." })
  .refine((v) => !Number.isNaN(Date.parse(v)) && v <= todayInColombo(), {
    error: "Enter a valid date of birth.",
  });

const personFields = {
  fullName: requiredText("Full name"),
  nameWithInitials: requiredText("Name with initials", 80),
  dateOfBirth: dobField,
  gender: z.enum(["M", "F"], { error: "Select a gender." }),
  district: z.enum(DISTRICTS, { error: "Select a district." }),
  consent: z.literal(true, { error: "You must agree to continue." }),
};

// ---------------------------------------------------------------------------
// Athlete
// ---------------------------------------------------------------------------

const currentYear = () => Number(todayInColombo().slice(0, 4));

const yearField = z.union([
  z.literal(""),
  z
    .union([z.string().trim().regex(/^\d{4}$/, { error: "Enter a 4-digit year." }), z.number().int()])
    .transform(Number)
    .refine((y) => y >= 1950 && y <= currentYear(), { error: "Enter a year between 1950 and now." }),
]);

export const coachLinkSchema = z
  .object({
    coachId: z.string().refine(isValidSlaaId, { error: "Invalid coach ID." }),
    relationship: z.enum(["CURRENT", "PAST"]),
    startYear: yearField,
    endYear: yearField,
    isPrimary: z.boolean(),
  })
  .superRefine((c, ctx) => {
    if (c.relationship === "CURRENT" && c.endYear !== "") {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "A current coach has no end year." });
    }
    if (c.relationship === "PAST" && c.isPrimary) {
      ctx.addIssue({ code: "custom", path: ["isPrimary"], message: "Only a current coach can be primary." });
    }
    if (c.startYear !== "" && c.endYear !== "" && c.endYear < c.startYear) {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "End year is before start year." });
    }
  });

/** One event row: the event, and optionally the personal best and where/when it was set. */
export const eventEntrySchema = z.object({
  code: z.string().refine((c) => EVENT_CODES.includes(c), { error: "Select an event." }),
  pb: z
    .string()
    .trim()
    .refine((v) => v === "" || PB_REGEX.test(v), {
      error: "Enter the personal best as numbers, e.g. 10.85, 1:52.30 or 6.45.",
    }),
  pbYear: yearField,
  pbCompetition: z.string().trim().max(120, { error: "Competition name is too long." }),
});

export type EventEntry = z.infer<typeof eventEntrySchema>;

/** A current or past coach who is not in the list. Phone number is optional. */
export const unlistedCoachSchema = z
  .object({
    name: requiredText("Coach name"),
    phone: z.string(),
    district: z.union([z.literal(""), z.enum(DISTRICTS)]),
    relationship: z.enum(["CURRENT", "PAST"]),
    startYear: yearField,
    endYear: yearField,
  })
  .superRefine((c, ctx) => {
    const phone = cleanPhone(c.phone);
    if (phone !== "" && !PHONE_REGEX.test(phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a Sri Lankan mobile number, e.g. 0771234567." });
    }
    if (c.relationship === "CURRENT" && c.endYear !== "") {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "A current coach has no end year." });
    }
    if (c.startYear !== "" && c.endYear !== "" && c.endYear < c.startYear) {
      ctx.addIssue({ code: "custom", path: ["endYear"], message: "End year is before start year." });
    }
  });

export type UnlistedCoach = z.infer<typeof unlistedCoachSchema>;

export const guardianSchema = z.object({
  fullName: requiredText("Guardian name"),
  relationship: requiredText("Relationship", 40),
  phone: phoneField,
  nic: z.union([z.literal(""), nicField]),
  consent: z.literal(true, { error: "The guardian must give consent." }),
});

export const athleteFormSchema = z
  .object({
    ...personFields,
    phone: phoneField,
    schoolOrClub: requiredText("School or club"),
    // the first event is the main event; any after that are additional
    events: z
      .array(eventEntrySchema)
      .min(1, { error: "Select at least 1 event." })
      .max(8, { error: "Up to 8 events." }),
    guardian: guardianSchema.nullable(),
    coaches: z.array(coachLinkSchema).max(10, { error: "Up to 10 coaches." }),
    unlistedCoaches: z.array(unlistedCoachSchema).max(5, { error: "Up to 5 coaches not in the list." }),
  })
  .superRefine((a, ctx) => {
    if (dobField.safeParse(a.dateOfBirth).success && ageOn(a.dateOfBirth) < 18 && !a.guardian) {
      ctx.addIssue({
        code: "custom",
        path: ["guardian"],
        message: "Athletes under 18 must give parent or guardian details.",
      });
    }
    if (a.coaches.filter((c) => c.isPrimary).length > 1) {
      ctx.addIssue({ code: "custom", path: ["coaches"], message: "Only one current coach can be primary." });
    }
    const codes = a.events.map((e) => e.code).filter(Boolean);
    a.events.forEach((e, i) => {
      if (e.code && codes.indexOf(e.code) !== i) {
        ctx.addIssue({ code: "custom", path: ["events", i, "code"], message: "An event is selected twice." });
      }
    });
    const current = a.coaches.filter((c) => c.relationship === "CURRENT").map((c) => c.coachId);
    if (new Set(current).size !== current.length) {
      ctx.addIssue({ code: "custom", path: ["coaches"], message: "The same coach is listed twice as current." });
    }
  });

export type AthleteForm = z.infer<typeof athleteFormSchema>;

export const athleteRegisterSchema = z.object({
  identity: identitySchema,
  form: athleteFormSchema,
  turnstileToken: z.string().min(1, { error: "Please complete the security check." }),
});

export const identityCheckSchema = z.object({
  identity: identitySchema,
  turnstileToken: z.string().min(1, { error: "Please complete the security check." }),
});

/** First error message per field path, for API 400 responses. */
export function flattenIssues(err: z.ZodError): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  for (const i of err.issues) {
    const key = i.path.join(".");
    if (!(key in fields)) fields[key] = i.message;
  }
  return { message: err.issues[0]?.message ?? "Please check the form.", fields };
}
