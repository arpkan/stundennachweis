import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcGesamtzeit,
  formatGesamtzeit,
  formatZeitraum,
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
