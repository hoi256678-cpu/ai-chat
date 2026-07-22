const HISTORY_KEY = "ai-chat-history";

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  time: string;
};

type HistoryMap = Record<string, StoredMessage[]>;

// Placeholder persistence: keeps each day's conversation in localStorage,
// keyed by "YYYY-MM-DD". Swap this out for real DB-backed storage later —
// callers only depend on get/append/list so the API surface won't change.
function readMap(): HistoryMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(HISTORY_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as HistoryMap;
  } catch {
    return {};
  }
}

function writeMap(map: HistoryMap) {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(map));
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey() {
  return formatDateKey(new Date());
}

export function getDayMessages(dateKey: string): StoredMessage[] {
  return readMap()[dateKey] ?? [];
}

export function appendDayMessage(dateKey: string, message: StoredMessage) {
  const map = readMap();
  map[dateKey] = [...(map[dateKey] ?? []), message];
  writeMap(map);
}

export function getDatesWithHistory(): string[] {
  return Object.keys(readMap()).filter((key) => readMap()[key].length > 0);
}
