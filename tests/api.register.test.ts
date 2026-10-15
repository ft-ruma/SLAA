import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, resetDb } from "./support/db";

// Turnstile is Cloudflare's job; here any token except "bad" passes.
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async (t: string) => t !== "bad" }));

const { POST: identityCheck } = await import("@/app/api/identity-check/route");
const { POST: registerAthlete } = await import("@/app/api/register/athlete/route");
const { GET: searchCoaches } = await import("@/app/api/coaches/search/route");
const { sql } = await import("@/lib/db");

const YY = String(new Date().getFullYear()).slice(2);

function post(body: unknown, cookie?: string) {
  return new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

const athleteForm = (over: Record<string, unknown> = {}) => ({
  fullName: "Nadeesha Dilhani Silva",
  nameWithInitials: "N. D. Silva",
  dateOfBirth: "2010-03-01",
  gender: "F",
  district: "Kandy",
  phone: "0711234567",
  schoolOrClub: "Mahamaya Girls' College",
  events: [
    { code: "400m", pb: "56.20", pbYear: "2025", pbCompetition: "Junior Nationals" },
    { code: "200m", pb: "", pbYear: "", pbCompetition: "" },
    { code: "LJ", pb: "5.10", pbYear: "", pbCompetition: "" },
  ],
  unlistedCoaches: [],
  guardian: null,
  coaches: [],
  consent: true,
  ...over,
});

const guardian = {
  fullName: "Sunil Silva",
  relationship: "Father",
  phone: "0779876543",
  nic: "",
  consent: true,
};

let passCookie = "";
let coachId = "";
let coach2Id = "";

// Coaches can no longer register on the site; they come from the Phase 1
// import (or staff), so the tests put them straight into the database.
async function seedCoach(nic: string, name: string, initials: string, dob: string, gender: string, district: string,
                         phone: string, email: string | null) {
  const [m] = await admin<{ slaa_id: string }[]>`
    INSERT INTO member (slaa_id, nic_as_entered, full_name, name_with_initials, date_of_birth, gender, district,
                        phone, email, consent_version, consent_at)
    VALUES (new_slaa_id('C'), ${nic}, ${name}, ${initials}, ${dob}, ${gender}, ${district}, ${phone}, ${email},
            'google-form-phase1', now())
    RETURNING slaa_id`;
  await admin`INSERT INTO coach (slaa_id, disciplines) VALUES (${m.slaa_id}, '{100m}')`;
  return m.slaa_id;
}

beforeAll(async () => {
  await resetDb();
  coachId = await seedCoach("853202937V", "Kamal Pradeep Perera", "K. P. Perera", "1985-11-15", "M", "Gampaha",
    "+94771234567", "kamal@example.com");
  coach2Id = await seedCoach("199076512345", "Anusha Kumari Fernando", "A. K. Fernando", "1990-09-21", "F", "Kandy",
    "+94770000002", null);
});
afterAll(async () => {
  await sql.end();
  await admin.end();
});

describe("identity check", () => {
  it("lets a new NIC continue and issues the search pass cookie", async () => {
    const res = await identityCheck(post({ identity: { type: "nic", nic: "881234567V" }, turnstileToken: "ok" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: false });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/slaa_pass=/);
    expect(setCookie.toLowerCase()).toContain("httponly");
    passCookie = setCookie.split(";")[0];
  });

  it("rejects a failed Turnstile check", async () => {
    const res = await identityCheck(post({ identity: { type: "nic", nic: "853202937V" }, turnstileToken: "bad" }));
    expect(res.status).toBe(403);
  });

  it("rejects a malformed NIC with 400", async () => {
    const res = await identityCheck(post({ identity: { type: "nic", nic: "854002937V" }, turnstileToken: "ok" }));
    expect(res.status).toBe(400);
  });
});

describe("public coach registration", () => {
  it("no longer exists", () => {
    expect(existsSync("src/app/api/register/coach")).toBe(false);
    expect(existsSync("src/app/register/coach")).toBe(false);
  });
});

describe("athlete registration with an NIC", () => {
  const adult = (nic: string, over: Record<string, unknown> = {}) =>
    post({
      identity: { type: "nic", nic },
      form: athleteForm({ fullName: "Ruwan Jayasinghe", nameWithInitials: "R. Jayasinghe", dateOfBirth: "1999-05-03", gender: "M", ...over }),
      turnstileToken: "ok",
    });

  it("returns an A ID and stores the normalised NIC", async () => {
    const res = await registerAthlete(adult("991240123V"));
    expect(res.status).toBe(201);
    const { slaaId } = await res.json();
    expect(slaaId).toMatch(new RegExp(`^A${YY}-000001-\\d$`));
    const [m] = await admin`SELECT nic, nic_as_entered, phone, consent_version FROM member WHERE slaa_id = ${slaaId}`;
    expect(m).toMatchObject({ nic: "199912400123", nic_as_entered: "991240123V", phone: "+94711234567" });
    expect(m.consent_version).toBeTruthy();
    const [a] = await admin`SELECT action, actor FROM audit_log WHERE slaa_id = ${slaaId}`;
    expect(a).toEqual({ action: "register_athlete", actor: "public" });
  });

  it("blocks the same NIC in the other format with 409", async () => {
    const res = await registerAthlete(adult("199912400123"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("This ID is already registered.");
  });

  it("takes date of birth and gender from the NIC, not the form", async () => {
    // 1995, female (765 - 500 = day 265)
    const res = await registerAthlete(adult("199576512345", { dateOfBirth: "1970-01-01", gender: "M" }));
    expect(res.status).toBe(201);
    const [m] = await admin`SELECT gender, date_of_birth::text dob FROM member WHERE slaa_id = ${(await res.json()).slaaId}`;
    expect(m).toEqual({ gender: "F", dob: "1995-09-21" });
  });

  it("registers with a Postal ID and blocks it the second time", async () => {
    const body = {
      identity: { type: "postal", postalId: "pid 12345" },
      form: athleteForm({ fullName: "Postal Person", nameWithInitials: "P. Person", dateOfBirth: "1998-05-04", gender: "M" }),
      turnstileToken: "ok",
    };
    expect((await registerAthlete(post(body))).status).toBe(201);
    const again = await registerAthlete(post({ ...body, identity: { type: "postal", postalId: "PID12345" } }));
    expect(again.status).toBe(409);
  });
});

describe("identity check on an existing member", () => {
  it("returns only the masked record, in either NIC format", async () => {
    for (const nic of ["853202937V", "198532002937"]) {
      const res = await identityCheck(post({ identity: { type: "nic", nic }, turnstileToken: "ok" }));
      const body = await res.json();
      expect(body).toEqual({ exists: true, slaaId: coachId, maskedName: "K. P*****", district: "Gampaha" });
    }
  });
});

describe("coach search", () => {
  it("requires the pass cookie from the identity check", async () => {
    const res = await searchCoaches(new Request("http://test/api/coaches/search?q=per"));
    expect(res.status).toBe(401);
  });

  it("never returns phone, email, NIC or full name", async () => {
    const res = await searchCoaches(new Request("http://test/api/coaches/search?q=per", { headers: { cookie: passCookie } }));
    const { results } = await res.json();
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(Object.keys(r).sort()).toEqual(["district", "name", "slaaId"]);
    const text = JSON.stringify(results);
    for (const secret of ["0771234567", "+94771234567", "kamal@example.com", "198532002937", "853202937V", "Kamal Pradeep"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("finds by SLAA ID and filters by district", async () => {
    const byId = await (await searchCoaches(new Request(`http://test/api/coaches/search?q=${coachId}`, { headers: { cookie: passCookie } }))).json();
    expect(byId.results.map((r: { slaaId: string }) => r.slaaId)).toEqual([coachId]);
    const kandy = await (await searchCoaches(new Request("http://test/api/coaches/search?q=fernando&district=Kandy", { headers: { cookie: passCookie } }))).json();
    expect(kandy.results).toEqual([{ slaaId: coach2Id, name: "A. K. Fernando", district: "Kandy" }]);
  });

  it("suggests coaches from the athlete's district when nothing is typed yet", async () => {
    const res = await searchCoaches(new Request("http://test/api/coaches/search?near=Kandy", { headers: { cookie: passCookie } }));
    const { results } = await res.json();
    expect(results).toEqual([{ slaaId: coach2Id, name: "A. K. Fernando", district: "Kandy" }]);
  });

  it("puts coaches from the athlete's district first, without hiding the others", async () => {
    await admin`UPDATE member SET full_name = 'Anusha Kumari Perera', name_with_initials = 'A. K. Perera' WHERE slaa_id = ${coach2Id}`;
    const res = await searchCoaches(new Request("http://test/api/coaches/search?q=perera&near=Kandy", { headers: { cookie: passCookie } }));
    const ids = (await res.json()).results.map((r: { slaaId: string }) => r.slaaId);
    expect(ids).toEqual([coach2Id, coachId]);
    await admin`UPDATE member SET full_name = 'Anusha Kumari Fernando', name_with_initials = 'A. K. Fernando' WHERE slaa_id = ${coach2Id}`;
  });

  it("ignores queries under 2 characters", async () => {
    const res = await searchCoaches(new Request("http://test/api/coaches/search?q=p", { headers: { cookie: passCookie } }));
    expect((await res.json()).results).toEqual([]);
  });
});

describe("athlete registration", () => {
  const minorNic = { type: "nic", nic: "201015601234" }; // 2010, male: under 18

  it("rejects a birth certificate as the ID", async () => {
    const res = await registerAthlete(post({
      identity: { type: "birth_cert", birthCertNo: "1234", birthCertDivision: "Kandy" },
      form: athleteForm({ guardian }), turnstileToken: "ok",
    }));
    expect(res.status).toBe(400);
    const check = await identityCheck(post({ identity: { type: "birth_cert", birthCertNo: "1234", birthCertDivision: "Kandy" }, turnstileToken: "ok" }));
    expect(check.status).toBe(400);
  });

  it("requires a guardian under 18", async () => {
    const res = await registerAthlete(post({ identity: minorNic, form: athleteForm({ gender: "M" }), turnstileToken: "ok" }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("guardian");
  });

  it("rejects two primary current coaches", async () => {
    const res = await registerAthlete(post({
      identity: minorNic,
      form: athleteForm({
        guardian,
        coaches: [
          { coachId, relationship: "CURRENT", startYear: "2022", endYear: "", isPrimary: true },
          { coachId: coach2Id, relationship: "CURRENT", startYear: "", endYear: "", isPrimary: true },
        ],
      }),
      turnstileToken: "ok",
    }));
    expect(res.status).toBe(400);
  });

  it("registers a minor with guardian and current + past coaches", async () => {
    const res = await registerAthlete(post({
      identity: minorNic,
      form: athleteForm({
        guardian,
        coaches: [
          { coachId, relationship: "CURRENT", startYear: "2023", endYear: "", isPrimary: true },
          { coachId: coach2Id, relationship: "PAST", startYear: "2019", endYear: "2022", isPrimary: false },
        ],
      }),
      turnstileToken: "ok",
    }));
    expect(res.status).toBe(201);
    const { slaaId } = await res.json();
    expect(slaaId).toMatch(new RegExp(`^A${YY}-000\\d{3}-\\d$`));

    const links = await admin`SELECT coach_id, relationship_type, is_primary, is_approved_by_coach FROM athlete_coach WHERE athlete_id = ${slaaId} ORDER BY relationship_type`;
    expect(links).toEqual([
      { coach_id: coachId, relationship_type: "CURRENT", is_primary: true, is_approved_by_coach: false },
      { coach_id: coach2Id, relationship_type: "PAST", is_primary: false, is_approved_by_coach: false },
    ]);
    expect((await admin`SELECT count(*)::int n FROM guardian WHERE athlete_id = ${slaaId}`)[0].n).toBe(1);

    // the same NIC again is already registered
    const again = await registerAthlete(post({ identity: { type: "nic", nic: "201015601234" }, form: athleteForm({ guardian }), turnstileToken: "ok" }));
    expect(again.status).toBe(409);
  });

  it("does not require a guardian for an adult", async () => {
    const res = await registerAthlete(post({
      identity: { type: "nic", nic: "200056701234" }, // 2000, female
      form: athleteForm({ fullName: "Ishara Madushani", nameWithInitials: "I. Madushani", dateOfBirth: "2000-02-26" }),
      turnstileToken: "ok",
    }));
    expect(res.status).toBe(201);
  });

  it("rolls back everything when a coach link is invalid", async () => {
    const before = (await admin`SELECT count(*)::int n FROM member`)[0].n;
    const res = await registerAthlete(post({
      identity: { type: "nic", nic: "199912345678" },
      form: athleteForm({
        fullName: "Test Rollback", nameWithInitials: "T. Rollback", dateOfBirth: "1999-05-03", gender: "M",
        coaches: [{ coachId: "C26-999999-8", relationship: "CURRENT", startYear: "", endYear: "", isPrimary: false }],
      }),
      turnstileToken: "ok",
    }));
    expect(res.status).toBe(400);
    expect((await admin`SELECT count(*)::int n FROM member`)[0].n).toBe(before);
  });
});

describe("events, personal bests and coaches not in the list", () => {
  let n = 0;
  const adult = (over: Record<string, unknown>) =>
    post({
      identity: { type: "nic", nic: `19970${String(10 + n++).padStart(2, "0")}01234` }, // a fresh 1997 NIC each time
      form: athleteForm({ fullName: "Event Tester", nameWithInitials: "E. Tester", dateOfBirth: "1997-01-10", gender: "M", ...over }),
      turnstileToken: "ok",
    });
  const ev = (code: string, pb = "") => ({ code, pb, pbYear: "", pbCompetition: "" });

  it("saves the events in order with their personal bests", async () => {
    const res = await registerAthlete(adult({}));
    expect(res.status).toBe(201);
    const { slaaId } = await res.json();
    expect(await admin`SELECT event_code, rank, personal_best, pb_year, pb_competition FROM athlete_event
                       WHERE athlete_id = ${slaaId} ORDER BY rank`).toEqual([
      { event_code: "400m", rank: 1, personal_best: "56.20", pb_year: 2025, pb_competition: "Junior Nationals" },
      { event_code: "200m", rank: 2, personal_best: null, pb_year: null, pb_competition: null },
      { event_code: "LJ", rank: 3, personal_best: "5.10", pb_year: null, pb_competition: null },
    ]);
    const [a] = await admin`SELECT main_events FROM athlete WHERE slaa_id = ${slaaId}`;
    expect(a.main_events).toEqual(["400m", "200m", "LJ"]);
  });

  it("accepts additional events after the 3 main ones", async () => {
    const res = await registerAthlete(adult({ events: [ev("100m"), ev("200m"), ev("400m"), ev("4x100m", "41.50")] }));
    expect(res.status).toBe(201);
  });

  it("needs at least 1 event, with a valid PB", async () => {
    const none = await registerAthlete(adult({ events: [] }));
    expect(none.status).toBe(400);
    expect((await none.json()).error).toBe("Select at least 1 event.");

    const dup = await registerAthlete(adult({ events: [ev("100m"), ev("200m"), ev("100m")] }));
    expect(dup.status).toBe(400);
    expect((await dup.json()).fields).toHaveProperty("events.2.code", "An event is selected twice.");

    const badPb = await registerAthlete(adult({ events: [ev("100m", "ten seconds"), ev("200m"), ev("400m")] }));
    expect(badPb.status).toBe(400);
    expect((await badPb.json()).fields).toHaveProperty("events.0.pb");

    const empty = await registerAthlete(adult({ events: [ev("100m"), ev(""), ev("400m")] }));
    expect(empty.status).toBe(400);
  });

  it("records current and past coaches who are not in the list", async () => {
    const res = await registerAthlete(adult({
      unlistedCoaches: [
        { name: "Mr. Bandara", phone: "076 111 2222", district: "Kandy", relationship: "CURRENT", startYear: "2023", endYear: "" },
        { name: "Mrs. Silva", phone: "", district: "", relationship: "PAST", startYear: "2018", endYear: "2021" },
      ],
    }));
    expect(res.status).toBe(201);
    const { slaaId } = await res.json();
    expect(await admin`SELECT coach_name, coach_phone, coach_district, relationship_type, start_year, end_year, status
                       FROM coach_request WHERE requested_by = ${slaaId} ORDER BY id`).toEqual([
      { coach_name: "Mr. Bandara", coach_phone: "+94761112222", coach_district: "Kandy", relationship_type: "CURRENT",
        start_year: 2023, end_year: null, status: "pending" },
      { coach_name: "Mrs. Silva", coach_phone: null, coach_district: null, relationship_type: "PAST",
        start_year: 2018, end_year: 2021, status: "pending" },
    ]);
  });

  it("accepts a current coach not in the list without a phone number", async () => {
    const res = await registerAthlete(adult({
      unlistedCoaches: [{ name: "No Phone", phone: "", district: "", relationship: "CURRENT", startYear: "", endYear: "" }],
    }));
    expect(res.status).toBe(201);
    const { slaaId } = await res.json();
    const [cr] = await admin`SELECT coach_phone FROM coach_request WHERE requested_by = ${slaaId} AND coach_name = 'No Phone'`;
    expect(cr.coach_phone).toBeNull();
  });

  it("rejects an invalid phone format for an unlisted coach", async () => {
    const res = await registerAthlete(adult({
      unlistedCoaches: [{ name: "Bad Phone", phone: "12345", district: "", relationship: "CURRENT", startYear: "", endYear: "" }],
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toHaveProperty("unlistedCoaches.0.phone");
  });

  it("the database also rejects a badly formatted PB", async () => {
    const [{ slaa_id }] = await admin`SELECT slaa_id FROM athlete LIMIT 1`;
    await expect(admin`INSERT INTO athlete_event (athlete_id, event_code, rank, personal_best)
                       VALUES (${slaa_id}, 'HT', 9, '12,5m')`).rejects.toMatchObject({ constraint_name: "athlete_event_pb_format" });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit per window, then blocks", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) {
      const [r] = await admin<{ ok: boolean }[]>`SELECT rate_limit_hit('t:1', 3, interval '1 minute') ok`;
      results.push(r.ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
