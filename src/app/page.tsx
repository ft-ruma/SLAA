import { cookies } from "next/headers";
import { LANG_COOKIE, isLang } from "@/lib/i18n";
import { LanguageChoice } from "./LanguageChoice";

// The front page of the site: every visit starts by choosing a language.
// ?next= brings people back to the page they came from (header language link,
// or a deep link such as a QR code to /register/check).
export default async function FrontPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // only same-site paths, so the link cannot send people to another website
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && next !== "/" ? next : "/home";
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  return <LanguageChoice next={safeNext} current={isLang(chosen) ? chosen : null} />;
}
