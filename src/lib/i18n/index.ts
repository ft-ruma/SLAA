// Public-site translations: English, Sinhala, Tamil. The admin area stays
// in English. Validation and server errors are written in English and
// translated here by their exact text (tErr), so the zod schemas and API
// routes stay shared and language-free.

import { EVENTS, PROVINCE_OF, type District } from "../reference";
import { en, type MessageKey } from "./en";
import { si, siCategories, siDistricts, siErrors, siEvents, siProvinces } from "./si";
import { ta, taCategories, taDistricts, taErrors, taEvents, taProvinces } from "./ta";

export const LANGS = ["en", "si", "ta"] as const;
export type Lang = (typeof LANGS)[number];
export type { MessageKey };

export const LANG_COOKIE = "lang";

/** Each language's name in its own script, for the switcher. */
export const LANG_LABELS: Record<Lang, string> = { en: "English", si: "සිංහල", ta: "தமிழ்" };

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

const MESSAGES = { en, si, ta };
const ERRORS: Record<Lang, Record<string, string>> = { en: {}, si: siErrors, ta: taErrors };
const DISTRICTS: Record<Lang, Record<string, string>> = { en: {}, si: siDistricts, ta: taDistricts };
const EVENT_NAMES: Record<Lang, Record<string, string>> = { en: {}, si: siEvents, ta: taEvents };
const PROVINCES: Record<Lang, Record<string, string>> = { en: {}, si: siProvinces, ta: taProvinces };
const CATEGORIES: Record<Lang, Record<string, string>> = { en: {}, si: siCategories, ta: taCategories };

export function t(lang: Lang, key: MessageKey, vars?: Record<string, string>): string {
  let s = MESSAGES[lang][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/** Translate an English error message; unknown messages are shown as they are. */
export function tErr(lang: Lang, message: string | undefined | null): string {
  if (!message) return "";
  return ERRORS[lang][message] ?? message;
}

export function districtName(lang: Lang, district: string) {
  return DISTRICTS[lang][district] ?? district;
}

/** Province name for a district, e.g. Kandy -> Central / මධ්‍යම / மத்திய. */
export function provinceOf(lang: Lang, district: string) {
  const p = PROVINCE_OF[district as District];
  return p ? (PROVINCES[lang][p] ?? p) : "";
}

export function eventName(lang: Lang, code: string) {
  return EVENT_NAMES[lang][code] ?? EVENTS.find((e) => e.code === code)?.name ?? code;
}

export function categoryName(lang: Lang, category: string) {
  return CATEGORIES[lang][category] ?? category;
}

// Browsers' built-in date formatting is patchy for Sinhala and Tamil, so
// month names are spelled out here.
const MONTHS: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
    "November", "December"],
  si: ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්",
    "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"],
  ta: ["ஜனவரி", "பெப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்", "செப்டம்பர்", "ஒக்டோபர்",
    "நவம்பர்", "டிசம்பர்"],
};

/** '2008-03-07' -> '7 March 2008' / '2008 මාර්තු 7' / '7 மார்ச் 2008' */
export function formatDate(lang: Lang, iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = MONTHS[lang][m - 1];
  return lang === "si" ? `${y} ${month} ${d}` : `${d} ${month} ${y}`;
}

/** Pick a language from an Accept-Language header, for first-time visitors. */
export function langFromAcceptLanguage(header: string | null): Lang {
  for (const part of (header ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLang(code)) return code;
  }
  return "en";
}
