import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcGesamtzeit,
  formatGesamtzeit,
  formatZeitraum,
  defaultEntryDate,
  nextWeekday,
  formatDatum,
  parseDatum,
  parseTime,
} from '../utils/format.ts';

test('calcGesamtzeit: Vollständige Fahrt = (Ankunft−Beginn) + (Ende−Abfahrt)', () => {
  // 07:00→07:35 (35 min) + 07:50→09:05 (75 min)
  assert.equal(calcGesamtzeit('07:00', '07:35', '07:50', '09:05'), 110);
});

test('calcGesamtzeit: nur Hinfahrt = Ankunft−Beginn', () => {
  assert.equal(calcGesamtzeit('06:45', '07:30', '', ''), 45);
});

test('calcGesamtzeit: nur Rückfahrt = Ende−Abfahrt', () => {
  assert.equal(calcGesamtzeit('', '', '13:15', '14:20'), 65);
});

test('calcGesamtzeit: Sonderfahrt = Ende−Beginn, ignores school times', () => {
  assert.equal(calcGesamtzeit('08:00', '', '', '12:30', true), 270);
  assert.equal(calcGesamtzeit('08:00', '09:00', '10:00', '12:30', true), 270);
});

test('calcGesamtzeit: no complete section gives 0', () => {
  assert.equal(calcGesamtzeit('', '', '', ''), 0);
  assert.equal(calcGesamtzeit('07:00', '', '', '09:00'), 0);
});

test('formatGesamtzeit uses German duration format', () => {
  assert.equal(formatGesamtzeit(0), '—');
  assert.equal(formatGesamtzeit(45), '45 Min.');
  assert.equal(formatGesamtzeit(120), '2 Std.');
  assert.equal(formatGesamtzeit(125), '2 Std. 5 Min.');
});

test('formatDatum / parseDatum round-trip DD.MM.YYYY', () => {
  const date = new Date(2026, 3, 1);
  assert.equal(formatDatum(date), '01.04.2026');
  assert.equal(parseDatum('01.04.2026').getTime(), date.getTime());
});

test('parseTime splits HH:MM', () => {
  assert.deepEqual(parseTime('07:05'), { hours: 7, minutes: 5 });
});

test('formatZeitraum shows first and last recorded time for every trip type', () => {
  assert.equal(formatZeitraum('07:00', '07:35', '07:50', '09:05'), '07:00 – 09:05');
  assert.equal(formatZeitraum('07:05', '07:35', '', ''), '07:05 – 07:35');
  assert.equal(formatZeitraum('', '', '07:45', '09:00'), '07:45 – 09:00');
  assert.equal(formatZeitraum('08:00', '', '', '12:30'), '08:00 – 12:30');
});

test('nextWeekday skips the weekend', () => {
  assert.equal(formatDatum(nextWeekday(new Date(2026, 3, 29))), '30.04.2026'); // Wed → Thu
  assert.equal(formatDatum(nextWeekday(new Date(2026, 4, 1))), '04.05.2026');  // Fri → Mon
});

test('defaultEntryDate follows the report month being viewed', () => {
  const today = new Date(2026, 9, 15, 10, 30); // Thu 15.10.2026
  // Latest April trip on 29.04 → 30.04, even if later months have trips
  assert.equal(formatDatum(defaultEntryDate(today, '2026-04-29', '2026-04')), '30.04.2026');
  // Report month without trips in the past → its first weekday (01.08.2026 is a Saturday)
  assert.equal(formatDatum(defaultEntryDate(today, null, '2026-08')), '03.08.2026');
  // Current month without trips → today
  assert.equal(formatDatum(defaultEntryDate(today, null, '2026-10')), '15.10.2026');
  // No report month given → today
  assert.equal(formatDatum(defaultEntryDate(today, null)), '15.10.2026');
});
