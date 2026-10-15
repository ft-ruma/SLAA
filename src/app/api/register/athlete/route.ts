import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { CONSENT_VERSION, errorResponse, parseRegistration, personFromIdentity } from "@/lib/register";
import { cleanNic } from "@/lib/nic";
import {
  ageOn,
  athleteRegisterSchema,
  cleanPhone,
  cleanText,
  normalizeIdentity,
  normalizePhone,
} from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = await parseRegistration(req, athleteRegisterSchema);
  if ("response" in parsed) return parsed.response;
  const { identity, form } = parsed.data;

  const id = normalizeIdentity(identity);
  const person = personFromIdentity(identity, form);
  const isMinor = ageOn(person.dateOfBirth) < 18;

  // The schema checked this against the posted DOB; re-check with the NIC one.
  if (isMinor && !form.guardian) {
    return NextResponse.json(
      {
        error: "Athletes under 18 must give parent or guardian details.",
        fields: { guardian: "Athletes under 18 must give parent or guardian details." },
      },
      { status: 400 },
    );
  }

  const coachIds = [...new Set(form.coaches.map((c) => c.coachId.toUpperCase()))];

  try {
    const slaaId = await sql.begin(async (tx) => {
      if (coachIds.length) {
        const active = await tx<{ slaa_id: string }[]>`
          SELECT c.slaa_id FROM coach c JOIN member m USING (slaa_id)
          WHERE c.slaa_id IN ${tx(coachIds)} AND m.status IN ('pending', 'verified')`;
        if (active.length !== coachIds.length) {
          throw Object.assign(new Error("inactive coach"), {
            code: "23503",
            constraint_name: "athlete_coach_coach_id_fkey",
          });
        }
      }

      const [m] = await tx<{ slaa_id: string }[]>`
        INSERT INTO member (slaa_id, nic_as_entered, postal_id,
                            full_name, name_with_initials, date_of_birth, gender, district, phone,
                            consent_version, consent_at)
        VALUES (new_slaa_id('A'), ${id.nic}, ${id.postalId},
                ${person.fullName}, ${person.nameWithInitials}, ${person.dateOfBirth}, ${person.gender},
                ${form.district}, ${normalizePhone(form.phone)}, ${CONSENT_VERSION}, now())
        RETURNING slaa_id`;
      const athleteId = m.slaa_id;

      await tx`
        INSERT INTO athlete (slaa_id, school_or_club, main_events)
        VALUES (${athleteId}, ${cleanText(form.schoolOrClub)}, ${form.events.map((e) => e.code)})`;

      // events in the order given: 1-3 are the main events
      for (const [i, e] of form.events.entries()) {
        await tx`
          INSERT INTO athlete_event (athlete_id, event_code, rank, personal_best, pb_year, pb_competition)
          VALUES (${athleteId}, ${e.code}, ${i + 1}, ${e.pb || null},
                  ${e.pbYear === "" ? null : e.pbYear}, ${cleanText(e.pbCompetition) || null})`;
      }

      if (isMinor && form.guardian) {
        const g = form.guardian;
        await tx`
          INSERT INTO guardian (athlete_id, full_name, relationship, phone, nic, consent_given_at, consent_ip)
          VALUES (${athleteId}, ${cleanText(g.fullName)}, ${cleanText(g.relationship)},
                  ${normalizePhone(g.phone)}, ${g.nic ? cleanNic(g.nic) : null}, now(),
                  ${isIP(parsed.ip) ? parsed.ip : null})`;
      }

      for (const c of form.coaches) {
        await tx`
          INSERT INTO athlete_coach (athlete_id, coach_id, relationship_type, is_primary,
                                     start_year, end_year, is_approved_by_coach)
          VALUES (${athleteId}, ${c.coachId.toUpperCase()}, ${c.relationship},
                  ${c.relationship === "CURRENT" && c.isPrimary},
                  ${c.startYear === "" ? null : c.startYear}, ${c.endYear === "" ? null : c.endYear}, false)`;
      }

      // coaches not in the list go to the admin follow-up queue
      for (const c of form.unlistedCoaches) {
        await tx`
          INSERT INTO coach_request (requested_by, coach_name, coach_phone, coach_district,
                                     relationship_type, start_year, end_year)
          VALUES (${athleteId}, ${cleanText(c.name)}, ${cleanPhone(c.phone) ? normalizePhone(c.phone) : null},
                  ${c.district || null}, ${c.relationship},
                  ${c.startYear === "" ? null : c.startYear}, ${c.endYear === "" ? null : c.endYear})`;
      }

      await tx`
        INSERT INTO audit_log (actor, action, slaa_id, details)
        VALUES ('public', 'register_athlete', ${athleteId}, ${tx.json({
          identity_type: identity.type,
          ip_hash: parsed.ipHash,
          coaches: form.coaches.length,
          unlisted_coaches: form.unlistedCoaches.length,
          events: form.events.length,
          guardian: isMinor,
        })})`;
      return athleteId;
    });

    return NextResponse.json({ slaaId }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "register athlete");
  }
}
