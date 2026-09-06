// Two independent, localStorage/sessionStorage-backed sets, both scoped to
// "today" (a stored dateKey that doesn't match resets the set to empty, so
// nothing needs manual pruning as days roll over):
//
// - "seen" (localStorage, survives reloads all day): controls the bell
//   badge on /main. Opening the notification popup marks everything shown
//   as seen; a dose that becomes newly due later gets a fresh, unseen key.
// - "toasted" (sessionStorage, cleared when the tab closes): controls the
//   global top-banner toast in DoseToaster — stops the same due dose from
//   re-toasting on every poll, independent of whether it's been "seen".

type DayRecord = { dateKey: string; keys: string[] };

function slotKey(medicationId: string, time: string): string {
  return `${medicationId}-${time}`;
}

function load(storage: Storage, storageKey: string, dateKey: string): Set<string> {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as DayRecord;
    if (parsed.dateKey !== dateKey) return new Set();
    return new Set(parsed.keys);
  } catch {
    return new Set();
  }
}

function save(storage: Storage, storageKey: string, dateKey: string, keys: Set<string>) {
  try {
    storage.setItem(storageKey, JSON.stringify({ dateKey, keys: Array.from(keys) }));
  } catch {
    // Private-mode storage or quota errors — the dedup is a nice-to-have,
    // never worth crashing the page over.
  }
}

const SEEN_STORAGE_KEY = "hm_seen_doses";
const TOASTED_STORAGE_KEY = "hm_toasted_doses";

export function isDoseSeen(
  dateKey: string,
  medicationId: string,
  time: string
): boolean {
  return load(window.localStorage, SEEN_STORAGE_KEY, dateKey).has(
    slotKey(medicationId, time)
  );
}

export function markDosesSeen(
  dateKey: string,
  slots: { medicationId: string; time: string }[]
) {
  const seen = load(window.localStorage, SEEN_STORAGE_KEY, dateKey);
  for (const slot of slots) seen.add(slotKey(slot.medicationId, slot.time));
  save(window.localStorage, SEEN_STORAGE_KEY, dateKey, seen);
}

export function isDoseToasted(
  dateKey: string,
  medicationId: string,
  time: string
): boolean {
  return load(window.sessionStorage, TOASTED_STORAGE_KEY, dateKey).has(
    slotKey(medicationId, time)
  );
}

export function markDoseToasted(dateKey: string, medicationId: string, time: string) {
  const toasted = load(window.sessionStorage, TOASTED_STORAGE_KEY, dateKey);
  toasted.add(slotKey(medicationId, time));
  save(window.sessionStorage, TOASTED_STORAGE_KEY, dateKey, toasted);
}
