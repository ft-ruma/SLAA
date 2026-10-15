import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";

// CSV export for SLAA staff. Every export is written to audit_log.

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(" ") : String(v);
  // stop spreadsheets treating a value as a formula
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8 names correctly
}

export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const type = new URL(req.url).searchParams.get("type") === "coaches" ? "coaches" : "members";

  const rows =
    type === "coaches"
      ? await sql`
          SELECT m.slaa_id, m.full_name, m.name_with_initials, m.nic, m.postal_id, m.date_of_birth::text AS date_of_birth,
                 m.gender, m.district, d.province, m.phone, m.email, m.status, c.slaa_license_no, c.license_level,
                 c.disciplines, c.is_verified, m.created_at
          FROM member m JOIN coach c USING (slaa_id) LEFT JOIN district d ON d.name = m.district
          WHERE m.status <> 'merged'
          ORDER BY m.slaa_id`
      : await sql`
          SELECT m.slaa_id,
                 concat_ws('+', CASE WHEN c.slaa_id IS NOT NULL THEN 'coach' END,
                                CASE WHEN a.slaa_id IS NOT NULL THEN 'athlete' END) AS type,
                 m.full_name, m.name_with_initials, m.nic, m.postal_id,
                 m.date_of_birth::text AS date_of_birth, m.gender, m.district, d.province,
                 m.phone, m.email, m.status, m.merged_into,
                 a.school_or_club,
                 -- "100m: 10.85 (2025, Junior Nationals); LJ: 6.45; 200m"
                 (SELECT string_agg(e.event_code
                          || coalesce(': ' || e.personal_best, '')
                          || coalesce(' (' || nullif(concat_ws(', ', e.pb_year::text, e.pb_competition), '') || ')', ''),
                          '; ' ORDER BY e.rank)
                    FROM athlete_event e WHERE e.athlete_id = m.slaa_id) AS events_and_pbs,
                 -- current primary coach
                 (SELECT cm.name_with_initials
                    FROM athlete_coach ac
                    JOIN member cm ON cm.slaa_id = ac.coach_id
                   WHERE ac.athlete_id = m.slaa_id
                     AND ac.relationship_type = 'CURRENT'
                     AND ac.is_primary
                   LIMIT 1) AS current_primary_coach,
                 -- all current coaches (comma-separated)
                 (SELECT string_agg(cm.name_with_initials, ', ' ORDER BY cm.name_with_initials)
                    FROM athlete_coach ac
                    JOIN member cm ON cm.slaa_id = ac.coach_id
                   WHERE ac.athlete_id = m.slaa_id
                     AND ac.relationship_type = 'CURRENT') AS current_coaches,
                 -- all past coaches (comma-separated)
                 (SELECT string_agg(cm.name_with_initials, ', ' ORDER BY cm.name_with_initials)
                    FROM athlete_coach ac
                    JOIN member cm ON cm.slaa_id = ac.coach_id
                   WHERE ac.athlete_id = m.slaa_id
                     AND ac.relationship_type = 'PAST') AS past_coaches,
                 c.disciplines, m.created_at
          FROM member m LEFT JOIN coach c USING (slaa_id) LEFT JOIN athlete a USING (slaa_id)
               LEFT JOIN district d ON d.name = m.district
          ORDER BY m.slaa_id`;

  await sql`
    INSERT INTO audit_log (actor, action, details)
    VALUES (${admin}, 'export', ${sql.json({ type, rows: rows.length })})`;

  const columns = rows.columns.map((c) => c.name);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(rows as unknown as Record<string, unknown>[], columns), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="slaa-${type}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
