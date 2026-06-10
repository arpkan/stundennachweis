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
  const t1 = parseTime(begin).hours * 60 + parseTime(begin).minutes;
  const t4 = parseTime(ende).hours * 60 + parseTime(ende).minutes;
  if (istSonderfahrt || !ankunft || !abfahrt) return t4 - t1;
  const t2 = parseTime(ankunft).hours * 60 + parseTime(ankunft).minutes;
  const t3 = parseTime(abfahrt).hours * 60 + parseTime(abfahrt).minutes;
  return (t2 - t1) + (t4 - t3);
}

export function formatGesamtzeit(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}
