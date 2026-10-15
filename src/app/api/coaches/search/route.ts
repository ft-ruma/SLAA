import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { hasValidPass, rateLimit } from "@/lib/guard";
import { initialsName } from "@/lib/names";
import { DISTRICTS } from "@/lib/reference";

// Coach picker search. Returns name with initials, district and SLAA ID only:
// never phone, email, NIC, date of birth or full name.
export async function GET(req: Request) {
  if (!hasValidPass(req)) {
    return NextResponse.json(
      { error: "Your session has expired. Please start the registration again." },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().replace(/\s+/g, " ");
  // district = only coaches in that district; near = that district first, others after
  const district = url.searchParams.get("district") ?? "";
  const near = url.searchParams.get("near") ?? "";
  if (q.length > 60) return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
  for (const d of [district, near]) {
    if (d && !(DISTRICTS as readonly string[]).includes(d)) {
      return NextResponse.json({ error: "Unknown district." }, { status: 400 });
    }
  }
  // With no search text, suggest coaches from the athlete's own district.
  const suggest = q.length === 0 && (district || near);
  if (q.length < 2 && !suggest) return NextResponse.json({ results: [] });

  const limited = await rateLimit(req, "search");
  if (limited) return limited;

  const like = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const only = district || (suggest ? near : "");
  const rank = district || near;
  const rows = await sql<{ slaa_id: string; name_with_initials: string | null; full_name: string; district: string }[]>`
    SELECT m.slaa_id, m.name_with_initials, m.full_name, m.district
    FROM coach c JOIN member m USING (slaa_id)
    WHERE m.status IN ('pending', 'verified')
      AND (${suggest ? true : false}
           OR m.name_with_initials ILIKE ${like} OR m.full_name ILIKE ${like}
           OR m.slaa_id ILIKE ${q.toUpperCase() + "%"})
      AND (${only} = '' OR m.district = ${only})
    ORDER BY (m.district = ${rank}) DESC, m.name_with_initials NULLS LAST, m.slaa_id
    LIMIT ${suggest ? 8 : 20}`;

  return NextResponse.json({
    results: rows.map((r) => ({
      slaaId: r.slaa_id,
      name: r.name_with_initials || initialsName(r.full_name),
      district: r.district,
    })),
  });
}
