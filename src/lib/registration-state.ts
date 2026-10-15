"use client";

import type { Identity } from "./validation";

// Carries the checked identity from step 1 to the form, and the new SLAA ID
// to the done page. sessionStorage only: it dies with the tab, and the server
// re-checks everything anyway.

export type CheckedIdentity = { identity: Identity; checkedAt: number };
export type DoneInfo = { slaaId: string; name: string; coachLinks: number };

const IDENTITY_KEY = "slaa.identity";
const DONE_KEY = "slaa.done";
const MAX_AGE_MS = 60 * 60 * 1000;

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked: the flow still works within this page load
  }
}

export function saveCheckedIdentity(v: Omit<CheckedIdentity, "checkedAt">) {
  write(IDENTITY_KEY, { ...v, checkedAt: Date.now() });
}

export function loadCheckedIdentity(): CheckedIdentity | null {
  const v = read<CheckedIdentity>(IDENTITY_KEY);
  if (!v || Date.now() - v.checkedAt > MAX_AGE_MS) return null;
  return v;
}

export function clearCheckedIdentity() {
  write(IDENTITY_KEY, null);
}

export function saveDone(v: DoneInfo) {
  write(DONE_KEY, v);
}

export function loadDone(): DoneInfo | null {
  return read<DoneInfo>(DONE_KEY);
}

// --- answers in progress ---------------------------------------------------
// Kept per tab (sessionStorage) so a reload, a language change or a slow
// network does not lose what was typed. Cleared on successful registration.
// Tied to the checked identity, so a different person starts with a blank form.

const DRAFT_KEY = "slaa.draft";

export type Draft<V, C> = { identity: string; values: V; coach: C; savedAt: number };

export function identityKey(identity: Identity) {
  return JSON.stringify(identity);
}

export function saveDraft<V, C>(identity: Identity, values: V, coach: C) {
  write(DRAFT_KEY, { identity: identityKey(identity), values, coach, savedAt: Date.now() });
}

export function loadDraft<V, C>(identity: Identity): Draft<V, C> | null {
  const d = read<Draft<V, C>>(DRAFT_KEY);
  if (!d || d.identity !== identityKey(identity) || Date.now() - d.savedAt > MAX_AGE_MS * 12) return null;
  return d;
}

export function clearDraft() {
  write(DRAFT_KEY, null);
}
