import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin as db, resetDb } from "./support/db";

let signedIn: string | null = "staff@slaa.lk";
vi.mock("@/lib/admin-auth", () => ({
  getAdmin: async () => signedIn,
  requireAdmin: async () => {
    if (!signedIn) throw new Error("NEXT_REDIRECT /admin/login");
    return signedIn;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));

const actions = await import("@/app/admin/(staff)/actions");
const { GET: exportCsv } = await import("@/app/api/admin/export/route");
const { sql } = await import("@/lib/db");

const form = (o: Record<string, string | number>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, String(v));
  return f;
};

async function member(kind: "C" | "A", nic: string, name: string, dob: string, gender = "M") {
  const [m] = await db<{ slaa_id: string }[]>`
    INSERT INTO member (slaa_id, nic_as_entered, full_name, name_with_initials, date_of_birth, gender, district,
                        phone, consent_version, consent_at)
    VALUES (new_slaa_id(${kind}), ${nic}, ${name}, ${name}, ${dob}, ${gender}, 'Galle', '+94770000000', 'test', now())
    RETURNING slaa_id`;
  if (kind === "C") await db`INSERT INTO coach (slaa_id, slaa_license_no) VALUES (${m.slaa_id}, ${"L-" + nic})`;
  else await db`INSERT INTO athlete (slaa_id, main_events) VALUES (${m.slaa_id}, '{100m}')`;
  return m.slaa_id;
}

beforeAll(resetDb);
afterAll(async () => {
  await sql.end();
  await db.end();
});

describe("admin actions", () => {
  it("verify sets member and coach verification and writes audit_log", async () => {
    const c = await member("C", "198001001234", "Coach One", "1980-01-01");
    await actions.verifyMember(form({ slaaId: c }));
    const [r] = await db`SELECT m.status, c.is_verified, c.verified_by FROM member m JOIN coach c USING (slaa_id) WHERE slaa_id = ${c}`;
    expect(r).toEqual({ status: "verified", is_verified: true, verified_by: "staff@slaa.lk" });
    expect((await db`SELECT action FROM audit_log WHERE slaa_id = ${c}`).map((a) => a.action)).toEqual(["verify"]);
  });

  it("rejects actions when not signed in", async () => {
    signedIn = null;
    await expect(actions.verifyMember(form({ slaaId: "C26-000001-3" }))).rejects.toThrow();
    const res = await exportCsv(new Request("http://test/api/admin/export"));
    expect(res.status).toBe(401);
    signedIn = "staff@slaa.lk";
  });

  it("merge moves coach links, keeps one primary and marks the duplicate merged", async () => {
    const coachA = await member("C", "197501001111", "Coach A", "1975-01-01");
    const coachB = await member("C", "197601001111", "Coach B", "1976-01-01");
    // same athlete registered twice (NIC and, say, postal ID typo'd as another NIC)
    const keep = await member("A", "200501001111", "Ama Perera", "2005-01-01");
    const dup = await member("A", "200501002222", "Ama Perera", "2005-01-01");

    await db`INSERT INTO athlete_coach (athlete_id, coach_id, relationship_type, is_primary) VALUES
      (${keep}, ${coachA}, 'CURRENT', true),
      (${dup}, ${coachA}, 'CURRENT', true),   -- clashes with keep's link: stays behind
      (${dup}, ${coachB}, 'CURRENT', false),  -- moves
      (${dup}, ${coachB}, 'PAST', false)`;     // moves
    await db`INSERT INTO coach_request (requested_by, coach_name, coach_phone, relationship_type, start_year, end_year)
             VALUES (${dup}, 'X', NULL, 'PAST', 2015, 2017)`;
    await db`INSERT INTO athlete_event (athlete_id, event_code, rank, personal_best) VALUES
      (${keep}, '100m', 1, '12.10'), (${dup}, '100m', 1, '12.50'), (${dup}, 'LJ', 2, '5.20')`;

    await expect(actions.mergeMembers(form({ keep, duplicate: dup }))).rejects.toMatchObject({ to: `/admin/members/${keep}` });

    const [d] = await db`SELECT status, merged_into FROM member WHERE slaa_id = ${dup}`;
    expect(d).toEqual({ status: "merged", merged_into: keep });
    const links = await db`SELECT coach_id, relationship_type, is_primary FROM athlete_coach WHERE athlete_id = ${keep} ORDER BY coach_id, relationship_type`;
    expect(links).toEqual([
      { coach_id: coachA, relationship_type: "CURRENT", is_primary: true },
      { coach_id: coachB, relationship_type: "CURRENT", is_primary: false },
      { coach_id: coachB, relationship_type: "PAST", is_primary: false },
    ]);
    expect((await db`SELECT requested_by FROM coach_request`)[0].requested_by).toBe(keep);
    // events the kept record lacked are copied over; its own PB wins for shared events
    expect(await db`SELECT event_code, rank, personal_best FROM athlete_event WHERE athlete_id = ${keep} ORDER BY rank`)
      .toEqual([{ event_code: "100m", rank: 1, personal_best: "12.10" }, { event_code: "LJ", rank: 2, personal_best: "5.20" }]);
    // the duplicate's NIC is free again (unique index excludes merged rows), so a re-registration
    // with it would be caught by the lookup only if not merged
    const audit = await db`SELECT action FROM audit_log WHERE slaa_id IN (${keep}, ${dup}) ORDER BY id`;
    expect(audit.map((a) => a.action)).toEqual(["merge", "merged_into"]);
  });

  it("merge refuses an already-merged record", async () => {
    const [d] = await db`SELECT slaa_id, merged_into FROM member WHERE status = 'merged' LIMIT 1`;
    await expect(actions.mergeMembers(form({ keep: d.merged_into, duplicate: d.slaa_id }))).rejects.toThrow(/merged/);
  });

  it("approves a coach link on the coach's behalf", async () => {
    const [l] = await db`SELECT id FROM athlete_coach WHERE NOT is_approved_by_coach LIMIT 1`;
    await actions.approveLink(form({ linkId: l.id }));
    expect((await db`SELECT is_approved_by_coach FROM athlete_coach WHERE id = ${l.id}`)[0].is_approved_by_coach).toBe(true);
  });

  it("resolves a coach request by linking the registered coach", async () => {
    const [r] = await db`SELECT id, requested_by FROM coach_request LIMIT 1`;
    const coach = await member("C", "197701001111", "Coach C", "1977-01-01");
    await actions.resolveRequest(form({ requestId: r.id, coachId: coach }));
    expect((await db`SELECT status, resolved_coach FROM coach_request WHERE id = ${r.id}`)[0])
      .toEqual({ status: "registered", resolved_coach: coach });
    // the athlete said this was a past coach (2015-2017), and the link keeps that
    expect(await db`SELECT relationship_type, start_year, end_year FROM athlete_coach
                    WHERE athlete_id = ${r.requested_by} AND coach_id = ${coach}`)
      .toEqual([{ relationship_type: "PAST", start_year: 2015, end_year: 2017 }]);
  });
});

describe("delete account", () => {
  it("does nothing unless the SLAA ID is retyped and a reason given", async () => {
    const a = await member("A", "200401001111", "Keep Me", "2004-01-01");
    await expect(actions.deleteMember(form({ slaaId: a, confirm: "C26-000001-3", reason: "x" })))
      .rejects.toMatchObject({ to: `/admin/members/${a}?deleteError=confirm` });
    await expect(actions.deleteMember(form({ slaaId: a, confirm: a, reason: " " })))
      .rejects.toMatchObject({ to: `/admin/members/${a}?deleteError=reason` });
    expect(await db`SELECT 1 FROM member WHERE slaa_id = ${a}`).toHaveLength(1);
  });

  it("removes the member and everything linked, keeps an audit row, and frees the NIC", async () => {
    const coach = await member("C", "197201001111", "Coach D", "1972-01-01");
    const a = await member("A", "200301001111", "Delete Me", "2003-01-01");
    await db`INSERT INTO athlete_coach (athlete_id, coach_id, relationship_type) VALUES (${a}, ${coach}, 'CURRENT')`;
    await db`INSERT INTO guardian (athlete_id, full_name, relationship, phone, consent_given_at) VALUES (${a}, 'G', 'Mother', '+94770000001', now())`;
    await db`INSERT INTO coach_request (requested_by, coach_name, coach_phone) VALUES (${a}, 'Y', '+94772222222')`;

    await expect(actions.deleteMember(form({ slaaId: a, confirm: a.toLowerCase(), reason: "Test entry" })))
      .rejects.toMatchObject({ to: `/admin?deleted=${a}` });

    for (const t of ["member", "athlete"]) {
      expect(await db`SELECT 1 FROM ${db(t)} WHERE slaa_id = ${a}`).toHaveLength(0);
    }
    expect(await db`SELECT 1 FROM athlete_coach WHERE athlete_id = ${a}`).toHaveLength(0);
    expect(await db`SELECT 1 FROM guardian WHERE athlete_id = ${a}`).toHaveLength(0);
    expect(await db`SELECT 1 FROM coach_request WHERE requested_by = ${a}`).toHaveLength(0);
    expect(await db`SELECT 1 FROM member WHERE slaa_id = ${coach}`).toHaveLength(1); // the coach stays

    const [log] = await db`SELECT actor, details FROM audit_log WHERE slaa_id = ${a} AND action = 'delete'`;
    expect(log).toEqual({ actor: "staff@slaa.lk", details: { reason: "Test entry", roles: ["athlete"] } });

    // the same NIC can register again
    await member("A", "200301001111", "Delete Me", "2003-01-01");
  });

  it("refuses to delete a record that others were merged into", async () => {
    const [k] = await db`SELECT merged_into AS id FROM member WHERE status = 'merged' LIMIT 1`;
    await expect(actions.deleteMember(form({ slaaId: k.id, confirm: k.id, reason: "x" })))
      .rejects.toMatchObject({ to: `/admin/members/${k.id}?deleteError=merged` });
  });

  it("the app role still cannot DELETE rows directly", async () => {
    await expect(sql`DELETE FROM member WHERE false`).rejects.toMatchObject({ code: "42501" });
  });
});

describe("bulk delete", () => {
  it("deletes the ticked accounts and reports the ones it skipped", async () => {
    const a = await member("A", "200201001111", "Bulk One", "2002-01-01");
    const b = await member("A", "200201002222", "Bulk Two", "2002-01-01");
    const [mergedInto] = await db`SELECT merged_into AS id FROM member WHERE status = 'merged' LIMIT 1`;
    const f = form({ confirm: "DELETE", reason: "Test entries" });
    for (const v of [a, b, mergedInto.id]) f.append("ids", v);

    await expect(actions.bulkDeleteMembers(f))
      .rejects.toMatchObject({ to: `/admin?bulkDeleted=2&skipped=${encodeURIComponent(mergedInto.id)}` });
    expect(await db`SELECT 1 FROM member WHERE slaa_id IN (${a}, ${b})`).toHaveLength(0);
    expect(await db`SELECT 1 FROM member WHERE slaa_id = ${mergedInto.id}`).toHaveLength(1);
    expect(await db`SELECT slaa_id FROM audit_log WHERE action = 'delete' AND details->>'reason' = 'Test entries' ORDER BY slaa_id`)
      .toEqual([{ slaa_id: a }, { slaa_id: b }].sort((x, y) => x.slaa_id.localeCompare(y.slaa_id)));
  });

  it("deletes nothing without DELETE typed, a reason, or a selection", async () => {
    const a = await member("A", "200101001111", "Bulk Three", "2001-01-01");
    const cases: [Record<string, string>, string][] = [
      [{ confirm: "delete", reason: "x" }, "confirm"],
      [{ confirm: "DELETE", reason: "" }, "reason"],
    ];
    for (const [fields, err] of cases) {
      const f = form(fields);
      f.append("ids", a);
      await expect(actions.bulkDeleteMembers(f)).rejects.toMatchObject({ to: `/admin?bulkError=${err}` });
    }
    await expect(actions.bulkDeleteMembers(form({ confirm: "DELETE", reason: "x" })))
      .rejects.toMatchObject({ to: "/admin?bulkError=selection" });
    expect(await db`SELECT 1 FROM member WHERE slaa_id = ${a}`).toHaveLength(1);
  });
});

describe("CSV export", () => {
  it("exports members and coaches and audits each export", async () => {
    await db`UPDATE member SET full_name = '=HYPERLINK("x")' WHERE slaa_id = (SELECT min(slaa_id) FROM member)`;
    const res = await exportCsv(new Request("http://test/api/admin/export?type=members"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toContain("slaa_id,type,full_name");
    expect(text.split("\r\n")[0]).toContain("district,province,");
    expect(text).toContain("100m: 12.10; LJ: 5.20");
    expect(text).not.toContain("()");
    expect(text).toContain(`"'=HYPERLINK(""x"")"`); // formula neutralised

    const coaches = await (await exportCsv(new Request("http://test/api/admin/export?type=coaches"))).text();
    expect(coaches).toContain("slaa_license_no");
    expect(coaches).not.toContain("Ama Perera");

    const exports = await db`SELECT actor, details FROM audit_log WHERE action = 'export' ORDER BY id`;
    expect(exports.map((e) => e.details.type)).toEqual(["members", "coaches"]);
  });
});
