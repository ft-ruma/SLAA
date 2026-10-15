import { afterAll, describe, expect, it } from "vitest";
import { normalizeNic } from "@/lib/nic";
import { DISTRICTS, EVENT_CODES, PB_REGEX, PROVINCE_OF } from "@/lib/reference";
import { checkDigit } from "@/lib/slaa-id";
import { admin } from "./support/db";

// The TypeScript mirrors must agree with the SQL that enforces the rules.

afterAll(() => admin.end());

describe("TypeScript matches SQL", () => {
  it("check digit agrees for many bodies", async () => {
    const bodies: string[] = [];
    for (let i = 0; i < 300; i++) {
      const kind = "ACO"[i % 3];
      const serial = String((i * 7919) % 1000000).padStart(6, "0");
      bodies.push(`${kind}${String(20 + (i % 10)).padStart(2, "0")}-${serial}`);
    }
    const rows = await admin<{ body: string; d: number }[]>`
      SELECT body, slaa_check_digit(body) AS d FROM unnest(${bodies}::text[]) AS body`;
    for (const r of rows) expect(checkDigit(r.body), r.body).toBe(r.d);
  });

  it("NIC normalisation agrees, including rejections", async () => {
    const samples = [
      "853202937V", "853202937v", "858202937X", "198532002937", "200006001234",
      "854002937V", "850002937V", "868702937V", "200186701234", "200136601234", "12345", "",
    ];
    for (const s of samples) {
      let sqlResult: string | null;
      try {
        const [r] = await admin<{ n: string | null }[]>`SELECT normalize_nic(${s}) AS n`;
        sqlResult = r.n;
      } catch {
        sqlResult = null;
      }
      expect(normalizeNic(s), s).toBe(sqlResult);
    }
  });

  it("reference lists match the seed data", async () => {
    const d = await admin<{ name: string }[]>`SELECT name FROM district ORDER BY name`;
    expect(d.map((r) => r.name)).toEqual([...DISTRICTS].sort());
    const e = await admin<{ code: string }[]>`SELECT code FROM event ORDER BY sort_order`;
    expect(e.map((r) => r.code)).toEqual(EVENT_CODES);
  });

  it("province of each district matches the seed data", async () => {
    const rows = await admin<{ name: string; province: string }[]>`SELECT name, province FROM district`;
    expect(Object.fromEntries(rows.map((r) => [r.name, r.province]))).toEqual(PROVINCE_OF);
  });

  it("personal-best format agrees with the database check", async () => {
    const samples = ["10.85", "1:52.30", "6.45", "5200", "2:15:30", "9", "10,85", "abc", "1.2.3.4", "", "123456"];
    for (const s of samples) {
      const [r] = await admin<{ ok: boolean }[]>`SELECT ${s} ~ '^[0-9]{1,5}([:.][0-9]{1,2}){0,2}$' AS ok`;
      expect(PB_REGEX.test(s), s).toBe(r.ok);
    }
  });

  it("masks names for the public lookup", async () => {
    const [r] = await admin<{ a: string; b: string; c: string }[]>`
      SELECT mask_name('K. P. Perera') a, mask_name('Kamal Perera') b, mask_name('Perera') c`;
    expect(r).toEqual({ a: "K. P*****", b: "K. P*****", c: "P*****" });
  });
});
