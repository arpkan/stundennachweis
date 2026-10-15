export function formatDatum(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getFullYear()}`;
}

export function formatDatumIso(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseDatum(datum: string): Date {
  const [d, m, y] = datum.split('.').map(Number);
  return new Date(y, m - 1, d);
}

export function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

export function calcGesamtzeit(
  begin: string,
  ankunft: string,
  abfahrt: string,
  ende: string,
  istSonderfahrt = false,
): number {
  if (istSonderfahrt) {
    const t1 = parseTime(begin).hours * 60 + parseTime(begin).minutes;
    const t4 = parseTime(ende).hours * 60 + parseTime(ende).minutes;
    return t4 - t1;
  }
  const hasMorning = !!begin && !!ankunft;
  const hasAfternoon = !!abfahrt && !!ende;
  let total = 0;
  if (hasMorning) {
    const t1 = parseTime(begin).hours * 60 + parseTime(begin).minutes;
    const t2 = parseTime(ankunft).hours * 60 + parseTime(ankunft).minutes;
    total += t2 - t1;
  }
  if (hasAfternoon) {
    const t3 = parseTime(abfahrt).hours * 60 + parseTime(abfahrt).minutes;
    const t4 = parseTime(ende).hours * 60 + parseTime(ende).minutes;
    total += t4 - t3;
  }
  return total;
}

/** First and last recorded time of a trip, e.g. "07:45 – 09:00" for a Rückfahrt-only trip. */
export function formatZeitraum(
  begin: string,
  ankunft: string,
  abfahrt: string,
  ende: string,
): string {
  const start = begin || abfahrt;
  const end = ende || ankunft;
  return `${start} – ${end}`;
}

export function formatGesamtzeit(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}
