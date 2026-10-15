import { redirect } from "next/navigation";
import { getAdmin, isAllowListed, supabaseConfigured, supabaseServer } from "@/lib/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Admin sign in · SLAA" };

async function sendLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // Only allow-listed emails get a link; everyone sees the same reply.
  if (isAllowListed(email) && supabaseConfigured()) {
    const supabase = await supabaseServer();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${site}/auth/callback`, shouldCreateUser: true },
    });
    if (error) console.error("magic link failed", error.message);
  }
  redirect("/admin/login?sent=1");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { sent, error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10 sm:py-16">
      <h1 className="text-2xl font-bold">SLAA staff sign in</h1>
      {sent ? (
        <p className="rounded-lg border bg-background p-4 text-sm">
          If this email belongs to an SLAA admin, a sign-in link has been sent. Open it on this device.
        </p>
      ) : (
        <form action={sendLink} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-11 text-base" />
          <Button type="submit" className="h-11">Email me a sign-in link</Button>
        </form>
      )}
      {error && <p className="text-sm text-destructive">The sign-in link was invalid or expired. Please try again.</p>}
      {!supabaseConfigured() && (
        <p className="text-xs text-muted-foreground">Supabase Auth is not configured on this server.</p>
      )}
    </div>
  );
}
