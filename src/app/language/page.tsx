import { redirect } from "next/navigation";

// Old address of the language screen; it is now the front page.
export default async function LanguageRedirect({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
}
