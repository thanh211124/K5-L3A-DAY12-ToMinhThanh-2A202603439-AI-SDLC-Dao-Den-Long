// Local leaderboard rules (Ticket-04 §3). Pure functions, shared by the server (disk storage), the export CLI and the browser.
export const MAX_ENTRIES = 10;
// 3–12 chars of [A-Za-z0-9_]; Vietnamese letters with diacritics are accepted too (bonus): any Unicode letter/number.
const NAME_RE = /^[\p{L}\p{M}\p{N}_]{3,12}$/u;

export function validateName(name) {
  if (typeof name !== 'string') return 'Tên phải là chuỗi';
  const n = name.normalize('NFC');
  if ([...n].length < 3 || [...n].length > 12) return 'Tên cần 3–12 ký tự';
  if (!NAME_RE.test(n)) return 'Chỉ dùng chữ, số và _ (có thể có dấu tiếng Việt)';
  return null;
}

// ISO 8601 with the local UTC offset, e.g. 2026-11-20T16:05:09+07:00
export function isoWithOffset(d = new Date()) {
  const pad = (v) => String(Math.floor(Math.abs(v))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

export function validateEntry(e) {
  if (!e || typeof e !== 'object') return 'entry must be an object';
  const bad = validateName(e.name);
  if (bad) return bad;
  if (!Number.isInteger(e.score) || e.score < 0) return 'score must be an int >= 0';
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) return 'nights_won must be 0..3';
  if (typeof e.achieved_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:\d\d)$/.test(e.achieved_at) || Number.isNaN(Date.parse(e.achieved_at))) return 'achieved_at must be ISO 8601 with a time zone';
  if (!Number.isInteger(e.seed)) return 'seed must be an int';
  return null;
}

// score desc; same score → whoever achieved it first ranks higher (earlier achieved_at, then insertion order)
export function sortEntries(entries) {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.score - a.e.score || Date.parse(a.e.achieved_at) - Date.parse(b.e.achieved_at) || a.i - b.i)
    .map(({ e }) => e);
}

export function addEntry(entries, entry) {
  const err = validateEntry(entry);
  if (err) throw new Error(err);
  const clean = { name: entry.name.normalize('NFC'), score: entry.score, nights_won: entry.nights_won, achieved_at: entry.achieved_at, seed: entry.seed };
  return sortEntries([...entries, clean]).slice(0, MAX_ENTRIES);
}
