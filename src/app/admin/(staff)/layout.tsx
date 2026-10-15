import Link from "next/link";
import { PageContainer } from "@/components/Page";
import { redirect } from "next/navigation";
import { requireAdmin, supabaseConfigured, supabaseServer } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  if (supabaseConfigured()) await (await supabaseServer()).auth.signOut();
  redirect("/admin/login");
}

const NAV = [
  ["/admin", "Members"],
  ["/admin/duplicates", "Possible duplicates"],
  ["/admin/coach-requests", "Coach requests"],
  ["/admin/confirmations", "Coach confirmations"],
] as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const email = await requireAdmin();
  return (
    <PageContainer size="wide" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between">
        {/* scrolls sideways on phones instead of wrapping into several lines */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm md:mx-0 md:px-0 md:pb-0">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href}
              className="shrink-0 rounded-full border bg-background px-3.5 py-1.5 font-medium text-primary hover:bg-primary/5">
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{email}</span>
          <button type="submit" className="shrink-0 underline">Sign out</button>
        </form>
      </div>
      {children}
    </PageContainer>
  );
}
