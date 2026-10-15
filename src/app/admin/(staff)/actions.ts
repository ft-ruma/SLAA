"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { isValidSlaaId } from "@/lib/slaa-id";

// Every admin action: check the session, change the row, write audit_log.

function id(formData: FormData, key = "slaaId") {
  const v = String(formData.get(key) ?? "").trim().toUpperCase();
  if (!isValidSlaaId(v)) throw new Error(`Invalid SLAA ID: ${v}`);
  return v;
}

export async function verifyMember(formData: FormData) {
  const admin = await requireAdmin();
  const slaaId = id(formData);
  await sql.begin(async (tx) => {
    const updated = await tx`
      UPDATE member SET status = 'verified'
      WHERE slaa_id = ${slaaId} AND status IN ('pending', 'suspended')
      RETURNING slaa_id`;
    if (!updated.length) return;
    await tx`
      UPDATE coach SET is_verified = true, verified_by = ${admin}, verified_at = now()
      WHERE slaa_id = ${slaaId}`;
    await tx`INSERT INTO audit_log (actor, action, slaa_id) VALUES (${admin}, 'verify', ${slaaId})`;
  });
  revalidatePath(`/admin/members/${slaaId}`);
}

export async function suspendMember(formData: FormData) {
  const admin = await requireAdmin();
  const slaaId = id(formData);
  const reason = String(formData.get("reason") ?? "").slice(0, 500);
  await sql.begin(async (tx) => {
    const updated = await tx`
      UPDATE member SET status = 'suspended'
      WHERE slaa_id = ${slaaId} AND status IN ('pending', 'verified')
      RETURNING slaa_id`;
    if (!updated.length) return;
    await tx`
      INSERT INTO audit_log (actor, action, slaa_id, details)
      VALUES (${admin}, 'suspend', ${slaaId}, ${tx.json({ reason })})`;
  });
  revalidatePath(`/admin/members/${slaaId}`);
}

/**
 * Merge `duplicate` into `keep`: the duplicate becomes status 'merged' and
 * its coach links, requests and guardians move to the kept record. Links that
 * would clash with one the kept record already has stay on the duplicate.
 */
export async function mergeMembers(formData: FormData) {
  const admin = await requireAdmin();
  const keep = id(formData, "keep");
  const dup = id(formData, "duplicate");
  if (keep === dup) throw new Error("Choose two different records");

  await sql.begin(async (tx) => {
    const rows = await tx<{ slaa_id: string; status: string }[]>`
      SELECT slaa_id, status FROM member WHERE slaa_id IN (${keep}, ${dup}) FOR UPDATE`;
    if (rows.length !== 2 || rows.some((r) => r.status === "merged")) {
      throw new Error("Both records must exist and not already be merged");
    }

    // Give the kept record the duplicate's roles if it lacks them.
    await tx`
      INSERT INTO athlete (slaa_id, school_or_club, main_events)
      SELECT ${keep}, school_or_club, main_events FROM athlete WHERE slaa_id = ${dup}
      ON CONFLICT (slaa_id) DO NOTHING`;
    const dupCoach = await tx`SELECT 1 FROM coach WHERE slaa_id = ${dup}`;
    const keepCoach = await tx`SELECT 1 FROM coach WHERE slaa_id = ${keep}`;
    if (dupCoach.length && !keepCoach.length) {
      const [c] = await tx`SELECT slaa_license_no FROM coach WHERE slaa_id = ${dup}`;
      await tx`UPDATE coach SET slaa_license_no = NULL WHERE slaa_id = ${dup}`;
      await tx`
        INSERT INTO coach (slaa_id, slaa_license_no, license_level, disciplines, is_verified, verified_by, verified_at)
        SELECT ${keep}, ${c.slaa_license_no}, license_level, disciplines, is_verified, verified_by, verified_at
        FROM coach WHERE slaa_id = ${dup}`;
    }

    // Links where the duplicate is the athlete
    await tx`
      UPDATE athlete_coach ac SET
        athlete_id = ${keep},
        is_primary = ac.is_primary AND NOT EXISTS (
          SELECT 1 FROM athlete_coach k WHERE k.athlete_id = ${keep}
            AND k.relationship_type = 'CURRENT' AND k.is_primary)
      WHERE ac.athlete_id = ${dup} AND ac.coach_id <> ${keep}
        AND NOT (ac.relationship_type = 'CURRENT' AND EXISTS (
          SELECT 1 FROM athlete_coach k WHERE k.athlete_id = ${keep}
            AND k.coach_id = ac.coach_id AND k.relationship_type = 'CURRENT'))`;

    // Links where the duplicate is the coach
    await tx`
      UPDATE athlete_coach ac SET coach_id = ${keep}
      WHERE ac.coach_id = ${dup} AND ac.athlete_id <> ${keep}
        AND NOT (ac.relationship_type = 'CURRENT' AND EXISTS (
          SELECT 1 FROM athlete_coach k WHERE k.coach_id = ${keep}
            AND k.athlete_id = ac.athlete_id AND k.relationship_type = 'CURRENT'))`;

    // events the kept record does not have yet, ranked after its own
    await tx`
      INSERT INTO athlete_event (athlete_id, event_code, rank, personal_best, pb_year, pb_competition)
      SELECT ${keep}, d.event_code,
             (SELECT coalesce(max(rank), 0) FROM athlete_event WHERE athlete_id = ${keep})
               + row_number() OVER (ORDER BY d.rank),
             d.personal_best, d.pb_year, d.pb_competition
      FROM athlete_event d
      WHERE d.athlete_id = ${dup}
        AND NOT EXISTS (SELECT 1 FROM athlete_event k WHERE k.athlete_id = ${keep} AND k.event_code = d.event_code)`;

    await tx`UPDATE coach_request SET requested_by = ${keep} WHERE requested_by = ${dup}`;
    await tx`UPDATE coach_request SET resolved_coach = ${keep} WHERE resolved_coach = ${dup}`;
    await tx`UPDATE guardian SET athlete_id = ${keep} WHERE athlete_id = ${dup}`;
    await tx`UPDATE member SET status = 'merged', merged_into = ${keep} WHERE slaa_id = ${dup}`;

    await tx`
      INSERT INTO audit_log (actor, action, slaa_id, details)
      VALUES (${admin}, 'merge', ${keep}, ${tx.json({ merged: dup })}),
             (${admin}, 'merged_into', ${dup}, ${tx.json({ kept: keep })})`;
  });
  revalidatePath("/admin/duplicates");
  redirect(`/admin/members/${keep}`);
}

export async function markRequestInvited(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  await sql.begin(async (tx) => {
    const [r] = await tx<{ requested_by: string }[]>`
      UPDATE coach_request SET status = 'invited' WHERE id = ${requestId} AND status = 'pending'
      RETURNING requested_by`;
    if (!r) return;
    await tx`
      INSERT INTO audit_log (actor, action, slaa_id, details)
      VALUES (${admin}, 'coach_request_invited', ${r.requested_by}, ${tx.json({ request_id: requestId })})`;
  });
  revalidatePath("/admin/coach-requests");
}

/** The requested coach has now registered: record it and link them to the athlete. */
export async function resolveRequest(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  const coachId = id(formData, "coachId");
  await sql.begin(async (tx) => {
    const [coach] = await tx`SELECT 1 FROM coach WHERE slaa_id = ${coachId}`;
    if (!coach) throw new Error(`${coachId} is not a registered coach`);
    const [r] = await tx<{ requested_by: string; relationship_type: string; start_year: number | null; end_year: number | null }[]>`
      UPDATE coach_request SET status = 'registered', resolved_coach = ${coachId}
      WHERE id = ${requestId} AND status IN ('pending', 'invited')
      RETURNING requested_by, relationship_type, start_year, end_year`;
    if (!r) return;
    // keep what the athlete said: current or past, and the years
    await tx`
      INSERT INTO athlete_coach (athlete_id, coach_id, relationship_type, is_primary, start_year, end_year,
                                 is_approved_by_coach)
      SELECT ${r.requested_by}, ${coachId}, ${r.relationship_type}, false, ${r.start_year}, ${r.end_year}, false
      WHERE NOT EXISTS (SELECT 1 FROM athlete_coach WHERE athlete_id = ${r.requested_by}
                          AND coach_id = ${coachId} AND relationship_type = ${r.relationship_type})`;
    await tx`
      INSERT INTO audit_log (actor, action, slaa_id, details)
      VALUES (${admin}, 'coach_request_registered', ${r.requested_by},
              ${tx.json({ request_id: requestId, coach: coachId })})`;
  });
  revalidatePath("/admin/coach-requests");
}

export async function rejectRequest(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = Number(formData.get("requestId"));
  await sql.begin(async (tx) => {
    const [r] = await tx<{ requested_by: string }[]>`
      UPDATE coach_request SET status = 'rejected' WHERE id = ${requestId} AND status IN ('pending', 'invited')
      RETURNING requested_by`;
    if (!r) return;
    await tx`
      INSERT INTO audit_log (actor, action, slaa_id, details)
      VALUES (${admin}, 'coach_request_rejected', ${r.requested_by}, ${tx.json({ request_id: requestId })})`;
  });
  revalidatePath("/admin/coach-requests");
}

/** Approve an athlete-coach link on the coach's behalf (after a phone call). */
export async function approveLink(formData: FormData) {
  const admin = await requireAdmin();
  const linkId = Number(formData.get("linkId"));
  await sql.begin(async (tx) => {
    const [l] = await tx<{ athlete_id: string; coach_id: string }[]>`
      UPDATE athlete_coach SET is_approved_by_coach = true
      WHERE id = ${linkId} AND NOT is_approved_by_coach
      RETURNING athlete_id, coach_id`;
    if (!l) return;
    await tx`
      INSERT INTO audit_log (actor, action, slaa_id, details)
      VALUES (${admin}, 'approve_coach_link', ${l.athlete_id},
              ${tx.json({ link_id: linkId, coach: l.coach_id, on_behalf_of_coach: true })})`;
  });
  revalidatePath("/admin/confirmations");
}

/**
 * Permanently delete a member and their personal details. The admin must
 * retype the SLAA ID and give a reason; audit_log keeps the reason only.
 */
export async function deleteMember(formData: FormData) {
  const admin = await requireAdmin();
  const slaaId = id(formData);
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (confirm !== slaaId) redirect(`/admin/members/${slaaId}?deleteError=confirm`);
  if (!reason) redirect(`/admin/members/${slaaId}?deleteError=reason`);

  try {
    await sql`SELECT admin_delete_member(${slaaId}, ${admin}, ${reason})`;
  } catch (e) {
    if ((e as { code?: string }).code === "55000") redirect(`/admin/members/${slaaId}?deleteError=merged`);
    throw e;
  }
  revalidatePath("/admin");
  redirect(`/admin?deleted=${slaaId}`);
}

/** Delete several ticked accounts from the members list. */
export async function bulkDeleteMembers(formData: FormData) {
  const admin = await requireAdmin();
  const ids = [...new Set(formData.getAll("ids").map((v) => String(v).trim().toUpperCase()))];
  const confirm = String(formData.get("confirm") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!ids.length || ids.length > 100 || !ids.every(isValidSlaaId)) redirect("/admin?bulkError=selection");
  if (confirm !== "DELETE") redirect("/admin?bulkError=confirm");
  if (!reason) redirect("/admin?bulkError=reason");

  // Each account is its own transaction (inside the function), so one that
  // cannot be deleted does not stop the others.
  const skipped: string[] = [];
  let deleted = 0;
  for (const slaaId of ids) {
    try {
      await sql`SELECT admin_delete_member(${slaaId}, ${admin}, ${reason})`;
      deleted++;
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "55000" && code !== "P0002") throw e;
      skipped.push(slaaId);
    }
  }
  revalidatePath("/admin");
  const params = new URLSearchParams({ bulkDeleted: String(deleted) });
  if (skipped.length) params.set("skipped", skipped.join(","));
  redirect(`/admin?${params}`);
}
