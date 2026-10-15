import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { markRequestInvited, rejectRequest, resolveRequest } from "../actions";
import { CopyButton } from "../CopyButton";
import { StatusBadge } from "../StatusBadge";

export const metadata = { title: "Coach requests · SLAA admin" };

type Req = {
  id: number; coach_name: string; coach_phone: string | null; coach_district: string | null; status: string;
  relationship_type: "CURRENT" | "PAST"; start_year: number | null; end_year: number | null;
  created_at: Date; requested_by: string; athlete_name: string; athlete_initials: string | null;
};

function inviteMessage(r: Req) {
  return (
    `Hello ${r.coach_name}, ${r.athlete_initials ?? "one of your athletes"} has listed you as their coach ` +
    `on the Sri Lanka Athletics national register. Please contact SLAA to be added as a coach.`
  );
}

export default async function CoachRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "open" } = await searchParams;
  const statuses = status === "open" ? ["pending", "invited"] : [status];

  const rows = await sql<Req[]>`
    SELECT r.*, m.full_name AS athlete_name, m.name_with_initials AS athlete_initials
    FROM coach_request r JOIN member m ON m.slaa_id = r.requested_by
    WHERE r.status IN ${sql(statuses)}
    ORDER BY r.created_at
    LIMIT 500`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Coach requests</h1>
        <nav className="flex gap-3 text-sm">
          {["open", "pending", "invited", "registered", "rejected"].map((s) => (
            <Link key={s} href={`?status=${s}`} className={s === status ? "font-semibold" : "text-primary"}>{s}</Link>
          ))}
        </nav>
      </div>
      <p className="text-sm text-muted-foreground">
        Coaches (current or past) that athletes typed in because they were not in the list. Contact them, then
        link them once they are registered as a coach.
      </p>

      {!rows.length && <p className="rounded-lg border bg-background p-6 text-center text-muted-foreground">Nothing here.</p>}

      {rows.map((r) => {
        const msg = inviteMessage(r);
        const wa = r.coach_phone && `https://wa.me/${r.coach_phone.replace(/^\+/, "")}?text=${encodeURIComponent(msg)}`;
        const sms = r.coach_phone && `sms:${r.coach_phone}?body=${encodeURIComponent(msg)}`;
        return (
          <section key={r.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.coach_name} <StatusBadge status={r.status} /></p>
                <p className="text-muted-foreground">
                  {r.relationship_type === "CURRENT" ? "Current coach" : "Past coach"}
                  {(r.start_year || r.end_year) && ` (${[r.start_year, r.end_year].filter(Boolean).join("–")})`}
                  {" · "}{r.coach_phone ?? "no phone given"} · {r.coach_district ?? "district not given"}
                </p>
                <p className="mt-1">
                  Requested by{" "}
                  <Link className="text-primary hover:underline" href={`/admin/members/${r.requested_by}`}>
                    {r.athlete_name} ({r.requested_by})
                  </Link>{" "}
                  on {r.created_at.toLocaleDateString("en-GB")}
                </p>
              </div>
            </div>
            {(r.status === "pending" || r.status === "invited") && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={msg} />
                  {wa && <a href={wa} target="_blank" rel="noreferrer" className="h-8 rounded-md border px-3 text-xs leading-8 hover:bg-muted">WhatsApp</a>}
                  {sms && <a href={sms} className="h-8 rounded-md border px-3 text-xs leading-8 hover:bg-muted">SMS</a>}
                  {r.status === "pending" && (
                    <form action={markRequestInvited}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <button className="h-8 rounded-md bg-sky-700 px-3 text-xs text-white">Mark invited</button>
                    </form>
                  )}
                  <form action={rejectRequest}>
                    <input type="hidden" name="requestId" value={r.id} />
                    <button className="h-8 rounded-md px-3 text-xs text-red-700 underline">Reject</button>
                  </form>
                </div>
                <form action={resolveRequest} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="requestId" value={r.id} />
                  <input name="coachId" required placeholder="Coach SLAA ID, e.g. C26-000123-4"
                    className="h-8 w-64 rounded-md border px-2 font-mono text-xs uppercase" />
                  <button className="h-8 rounded-md bg-emerald-700 px-3 text-xs text-white">Coach registered: link</button>
                </form>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
