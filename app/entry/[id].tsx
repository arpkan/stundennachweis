import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable, Switch,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from '@/utils/platform/storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { DateTimePicker, type DateTimePickerEvent } from '@/utils/platform/date-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { useThemeColors, typography, spacing, radii, shadows } from '@/theme';
import { TimeField } from '@/components/ui/TimeField';
import { TourChips } from '@/components/ui/TourChips';
import {
  formatDatum, formatDatumIso, parseDatum,
  calcGesamtzeit, formatGesamtzeit, parseTime, defaultEntryDate,
} from '@/utils/format';
import {
  getTripById, insertTrip, updateTrip,
  getRecentTourNumbers,
  getAllSettings, getLastTrip, getLastTripInReportMonth,
} from '@/db/queries';
import type { NewTrip } from '@/db/types';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

type FormState = {
  datum: string;
  datumIso: string;
  berichtMonat: string;
  istSonderfahrt: boolean;
  hasHinfahrt: boolean;
  hasRueckfahrt: boolean;
  beginFahrt: string;
  ankunftSchule: string;
  abfahrtSchule: string;
  endeFahrt: string;
  tourNr: string;
  besonderheiten: string;
};

const DEFAULT_FORM: FormState = {
  datum: '',
  datumIso: '',
  berichtMonat: '',
  istSonderfahrt: false,
  hasHinfahrt: true,
  hasRueckfahrt: true,
  beginFahrt: '07:00',
  ankunftSchule: '07:30',
  abfahrtSchule: '07:45',
  endeFahrt: '09:00',
  tourNr: '',
  besonderheiten: '',
};

// Returns the field values that will actually be stored, respecting section toggles
function effectiveFields(form: FormState) {
  if (form.istSonderfahrt) {
    return {
      beginFahrt:    form.beginFahrt,
      ankunftSchule: '',
      abfahrtSchule: '',
      endeFahrt:     form.endeFahrt,
    };
  }
  return {
    beginFahrt:    form.hasHinfahrt   ? form.beginFahrt    : '',
    ankunftSchule: form.hasHinfahrt   ? form.ankunftSchule : '',
    abfahrtSchule: form.hasRueckfahrt ? form.abfahrtSchule : '',
    endeFahrt:     form.hasRueckfahrt ? form.endeFahrt     : '',
  };
}

export default function EntryScreen() {
  const { id, from, bm } = useLocalSearchParams<{ id: string; from?: string; bm?: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormState | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [openField, setOpenField] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [besonderheitenOpen, setBesonderheitenOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const today = new Date();
      const recentTours = await getRecentTourNumbers(db, 3);
      setChips(recentTours);

      if (!isNew) {
        const trip = await getTripById(db, Number(id));
        if (trip) {
          setForm({
            datum: trip.datum,
            datumIso: trip.datumIso,
            berichtMonat: trip.berichtMonat,
            istSonderfahrt: trip.istSonderfahrt,
            hasHinfahrt: trip.istSonderfahrt ? true : !!trip.beginFahrt,
            hasRueckfahrt: trip.istSonderfahrt ? true : !!trip.endeFahrt,
            beginFahrt:    trip.beginFahrt    || '07:00',
            ankunftSchule: trip.ankunftSchule || '07:30',
            abfahrtSchule: trip.abfahrtSchule || '07:45',
            endeFahrt:     trip.endeFahrt     || '09:00',
            tourNr: trip.tourNr,
            besonderheiten: trip.besonderheiten ?? '',
          });
          if (trip.besonderheiten) setBesonderheitenOpen(true);
          return;
        }
      }

      // Wiederholen: copy a previous trip with today's date
      if (from) {
        const source = await getTripById(db, Number(from));
        if (source) {
          const bmForNew = bm || formatDatumIso(today).slice(0, 7);
          setForm({
            datum: formatDatum(today),
            datumIso: formatDatumIso(today),
            berichtMonat: bmForNew,
            istSonderfahrt: source.istSonderfahrt,
            hasHinfahrt: source.istSonderfahrt ? true : !!source.beginFahrt,
            hasRueckfahrt: source.istSonderfahrt ? true : !!source.endeFahrt,
            beginFahrt:    source.beginFahrt    || '07:00',
            ankunftSchule: source.ankunftSchule || '07:30',
            abfahrtSchule: source.abfahrtSchule || '07:45',
            endeFahrt:     source.endeFahrt     || '09:00',
            tourNr: source.tourNr,
            besonderheiten: '',
          });
          return;
        }
      }

      // Default date: next weekday after the latest trip of the report month being viewed
      const lastTrip = bm ? await getLastTripInReportMonth(db, bm) : await getLastTrip(db);
      const defaultDate = defaultEntryDate(today, lastTrip?.datumIso ?? null, bm);

      const weekday = defaultDate.getDay();
      const settings = await getAllSettings(db);

      const hasUserDefaults = settings.defaultBeginn !== '07:00' || settings.defaultEnde !== '09:00';

      let baseTimes = {
        beginn_fahrt:    settings.defaultBeginn,
        ankunft_schule:  settings.defaultAnkunft,
        abfahrt_schule:  settings.defaultAbfahrt,
        ende_fahrt:      settings.defaultEnde,
      };

      if (!hasUserDefaults) {
        const lastSimilar = await db.getFirstAsync<{
          beginn_fahrt: string;
          ankunft_schule: string;
          abfahrt_schule: string;
          ende_fahrt: string;
        }>(
          `SELECT beginn_fahrt, ankunft_schule, abfahrt_schule, ende_fahrt
           FROM trips
           WHERE CAST(strftime('%w', datum_iso) AS INTEGER) = ?
           ORDER BY datum_iso DESC
           LIMIT 1`,
          [weekday]
        );
        if (lastSimilar) {
          baseTimes = lastSimilar;
        }
      }

      setForm({
        ...DEFAULT_FORM,
        datum: formatDatum(defaultDate),
        datumIso: formatDatumIso(defaultDate),
        berichtMonat: bm || formatDatumIso(defaultDate).slice(0, 7),
        // Inherit half-day pattern from history; default to full day for settings
        hasHinfahrt:  !hasUserDefaults ? !!baseTimes.beginn_fahrt  : true,
        hasRueckfahrt: !hasUserDefaults ? !!baseTimes.ende_fahrt   : true,
        beginFahrt:    baseTimes.beginn_fahrt   || '07:00',
        ankunftSchule: baseTimes.ankunft_schule || '07:30',
        abfahrtSchule: baseTimes.abfahrt_schule || '07:45',
        endeFahrt:     baseTimes.ende_fahrt     || '09:00',
        tourNr: settings.defaultTour || (recentTours[0] ?? ''),
      });
    }
    load();
  }, []);

  const set = useCallback((field: keyof FormState, value: string | boolean) => {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const handleDateChange = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      set('datum', formatDatum(date));
      set('datumIso', formatDatumIso(date));
    }
  };

  const handleToggleDatePicker = () => {
    setShowDatePicker((prev) => !prev);
    if (!showDatePicker) setOpenField(null);
  };

  const handleToggleField = (field: string) => {
    setOpenField((prev) => (prev === field ? null : field));
    if (field) setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (!form) return;

    if (!form.tourNr.trim()) {
      setError('Bitte geben Sie eine Tour-Nr. ein');
      return;
    }

    const ef = effectiveFields(form);
    let gz: number;

    if (form.istSonderfahrt) {
      const t1 = parseTime(ef.beginFahrt).hours * 60 + parseTime(ef.beginFahrt).minutes;
      const t4 = parseTime(ef.endeFahrt).hours * 60 + parseTime(ef.endeFahrt).minutes;
      gz = t4 - t1;
    } else {
      if (!form.hasHinfahrt && !form.hasRueckfahrt) {
        setError('Mindestens eine Fahrtrichtung (Hinfahrt oder Rückfahrt) muss ausgewählt sein');
        return;
      }
      if (form.hasHinfahrt) {
        const t1 = parseTime(ef.beginFahrt).hours * 60 + parseTime(ef.beginFahrt).minutes;
        const t2 = parseTime(ef.ankunftSchule).hours * 60 + parseTime(ef.ankunftSchule).minutes;
        if (t2 < t1) { setError('Ankunft Schule darf nicht vor Beginn liegen'); return; }
      }
      if (form.hasRueckfahrt) {
        const t3 = parseTime(ef.abfahrtSchule).hours * 60 + parseTime(ef.abfahrtSchule).minutes;
        const t4 = parseTime(ef.endeFahrt).hours * 60 + parseTime(ef.endeFahrt).minutes;
        if (t4 < t3) { setError('Ende Fahrt darf nicht vor Abfahrt liegen'); return; }
      }
      gz = calcGesamtzeit(ef.beginFahrt, ef.ankunftSchule, ef.abfahrtSchule, ef.endeFahrt, false);
    }

    if (gz <= 0) {
      setError('Die Fahrzeit muss größer als 0 sein');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const today = new Date();
      const datumIso = form.datumIso || formatDatumIso(today);
      const finalTrip: NewTrip = {
        datum:         form.datum || formatDatum(today),
        datumIso,
        berichtMonat:  form.berichtMonat || datumIso.slice(0, 7),
        istSonderfahrt: form.istSonderfahrt,
        beginFahrt:    ef.beginFahrt,
        ankunftSchule: ef.ankunftSchule,
        abfahrtSchule: ef.abfahrtSchule,
        endeFahrt:     ef.endeFahrt,
        gesamtzeit:    gz,
        tourNr:        form.tourNr.trim(),
        besonderheiten: form.besonderheiten?.trim() || null,
        aufgezeichnetAm: formatDatum(today),
      };

      if (isNew) {
        await insertTrip(db, finalTrip);
      } else {
        await updateTrip(db, Number(id), finalTrip);
      }

      router.back();
    } catch (e) {
      console.error('Save error:', e);
      setError(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.screen, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const ef = effectiveFields(form);
  const gesamtzeit = calcGesamtzeit(ef.beginFahrt, ef.ankunftSchule, ef.abfahrtSchule, ef.endeFahrt, form.istSonderfahrt);

  // Live field-level error indicators
  let ankunftError = false;
  if (!form.istSonderfahrt && form.hasHinfahrt) {
    const t1 = parseTime(form.beginFahrt).hours * 60 + parseTime(form.beginFahrt).minutes;
    const t2 = parseTime(form.ankunftSchule).hours * 60 + parseTime(form.ankunftSchule).minutes;
    if (t2 < t1) ankunftError = true;
  }

  let endeError = false;
  if (form.istSonderfahrt) {
    const t1 = parseTime(form.beginFahrt).hours * 60 + parseTime(form.beginFahrt).minutes;
    const t4 = parseTime(form.endeFahrt).hours * 60 + parseTime(form.endeFahrt).minutes;
    if (t4 < t1) endeError = true;
  } else if (form.hasRueckfahrt) {
    const t3 = parseTime(form.abfahrtSchule).hours * 60 + parseTime(form.abfahrtSchule).minutes;
    const t4 = parseTime(form.endeFahrt).hours * 60 + parseTime(form.endeFahrt).minutes;
    if (t4 < t3) endeError = true;
  }

  const labelStyle = {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  } as const;

  const fieldStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.input,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 56,
  } as const;

  const sectionToggleStyle = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    ...fieldStyle,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg.screen }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.base,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.base,
          backgroundColor: colors.bg.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary }}>
          {isNew ? 'Neue Fahrt' : 'Fahrt bearbeiten'}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <X size={24} color={colors.text.secondary} pointerEvents="none" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.base, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Datum */}
        <View>
          <Text style={labelStyle}>Datum</Text>
          <Pressable
            onPress={handleToggleDatePicker}
            style={[
              fieldStyle,
              {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderColor: showDatePicker ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={{
                fontSize: typography.sizes.xl,
                fontWeight: typography.weights.bold,
                color: showDatePicker ? colors.primary : colors.text.primary,
              }}
            >
              {form.datum}
            </Text>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
              {showDatePicker ? 'Schließen' : 'Datum ändern'}
            </Text>
          </Pressable>
          {showDatePicker && (
            <View
              style={{
                backgroundColor: colors.bg.card,
                borderRadius: radii.md,
                marginTop: spacing.sm,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.primary,
              }}
            >
              <DateTimePicker
                value={parseDatum(form.datum)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
                locale="de-DE"
                themeVariant={colors.bg.screen === '#0F172A' ? 'dark' : 'light'}
                textColor={colors.text.primary}
              />
            </View>
          )}
          {(() => {
            if (!form.berichtMonat) return null;
            const [bmY, bmM] = form.berichtMonat.split('-').map(Number);
            return (
              <Text style={{ fontSize: typography.sizes.xs, color: colors.text.secondary, marginTop: spacing.xs }}>
                Abrechnungsmonat: {MONTH_NAMES[bmM - 1]} {bmY}
              </Text>
            );
          })()}
        </View>

        {/* Sonderfahrt toggle */}
        <View style={sectionToggleStyle}>
          <View>
            <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
              Sonderfahrt
            </Text>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.text.secondary, marginTop: 2 }}>
              Gesamtzeit = Beginn bis Ende
            </Text>
          </View>
          <Switch
            value={form.istSonderfahrt}
            onValueChange={(v) => set('istSonderfahrt', v)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.text.inverse}
          />
        </View>

        {/* Sonderfahrt mode: Beginn + Ende only */}
        {form.istSonderfahrt && (
          <>
            <View>
              <Text style={labelStyle}>Beginn Fahrt</Text>
              <TimeField
                label="Beginn Fahrt"
                value={form.beginFahrt}
                onChange={(v) => set('beginFahrt', v)}
                isOpen={openField === 'beginFahrt'}
                onToggle={() => handleToggleField('beginFahrt')}
                isInvalid={false}
              />
            </View>
            <View>
              <Text style={labelStyle}>Ende Fahrt</Text>
              <TimeField
                label="Ende Fahrt"
                value={form.endeFahrt}
                onChange={(v) => set('endeFahrt', v)}
                isOpen={openField === 'endeFahrt'}
                onToggle={() => handleToggleField('endeFahrt')}
                isInvalid={endeError}
              />
            </View>
          </>
        )}

        {/* Normal mode: Hinfahrt + Rückfahrt sections */}
        {!form.istSonderfahrt && (
          <>
            {/* Hinfahrt section */}
            <View style={sectionToggleStyle}>
              <View>
                <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
                  Hinfahrt
                </Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.text.secondary, marginTop: 2 }}>
                  Beginn bis Ankunft Schule
                </Text>
              </View>
              <Switch
                value={form.hasHinfahrt}
                onValueChange={(v) => set('hasHinfahrt', v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text.inverse}
              />
            </View>

            {form.hasHinfahrt && (
              <>
                <View>
                  <Text style={labelStyle}>Beginn Fahrt</Text>
                  <TimeField
                    label="Beginn Fahrt"
                    value={form.beginFahrt}
                    onChange={(v) => set('beginFahrt', v)}
                    isOpen={openField === 'beginFahrt'}
                    onToggle={() => handleToggleField('beginFahrt')}
                    isInvalid={false}
                  />
                </View>
                <View>
                  <Text style={labelStyle}>Ankunft Schule / Werkstätte</Text>
                  <TimeField
                    label="Ankunft Schule / Werkstätte"
                    value={form.ankunftSchule}
                    onChange={(v) => set('ankunftSchule', v)}
                    isOpen={openField === 'ankunftSchule'}
                    onToggle={() => handleToggleField('ankunftSchule')}
                    isInvalid={ankunftError}
                  />
                </View>
              </>
            )}

            {/* Rückfahrt section */}
            <View style={sectionToggleStyle}>
              <View>
                <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
                  Rückfahrt
                </Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.text.secondary, marginTop: 2 }}>
                  Abfahrt Schule bis Ende
                </Text>
              </View>
              <Switch
                value={form.hasRueckfahrt}
                onValueChange={(v) => set('hasRueckfahrt', v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.text.inverse}
              />
            </View>

            {form.hasRueckfahrt && (
              <>
                <View>
                  <Text style={labelStyle}>Abfahrt Schule / Werkstätte</Text>
                  <TimeField
                    label="Abfahrt Schule / Werkstätte"
                    value={form.abfahrtSchule}
                    onChange={(v) => set('abfahrtSchule', v)}
                    isOpen={openField === 'abfahrtSchule'}
                    onToggle={() => handleToggleField('abfahrtSchule')}
                    isInvalid={false}
                  />
                </View>
                <View>
                  <Text style={labelStyle}>Ende Fahrt</Text>
                  <TimeField
                    label="Ende Fahrt"
                    value={form.endeFahrt}
                    onChange={(v) => set('endeFahrt', v)}
                    isOpen={openField === 'endeFahrt'}
                    onToggle={() => handleToggleField('endeFahrt')}
                    isInvalid={endeError}
                  />
                </View>
              </>
            )}
          </>
        )}

        {/* Gesamtzeit */}
        <View
          style={{
            backgroundColor: (gesamtzeit > 0 && !error) ? colors.primary : colors.bg.subtle,
            borderRadius: radii.md,
            padding: spacing.base,
            alignItems: 'center',
            ...shadows.card,
            borderWidth: gesamtzeit <= 0 ? 1 : 0,
            borderColor: colors.error,
          }}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: (gesamtzeit > 0 && !error) ? colors.text.inverse : colors.text.secondary,
              marginBottom: 4,
              opacity: 0.9,
            }}
          >
            Gesamtzeit
          </Text>
          <Text
            style={{
              fontSize: typography.sizes.xl,
              fontWeight: typography.weights.bold,
              color: (gesamtzeit > 0 && !error) ? colors.text.inverse : colors.error,
            }}
          >
            {formatGesamtzeit(gesamtzeit)}
          </Text>
        </View>

        {/* Tour-Nr. */}
        <View>
          <Text style={labelStyle}>Tour-Nr.</Text>
          <TourChips chips={chips} selected={form.tourNr} onSelect={(v) => set('tourNr', v)} />
          <TextInput
            value={form.tourNr}
            onChangeText={(v) => set('tourNr', v)}
            keyboardType="default"
            placeholder="Tour-Nr. eingeben"
            placeholderTextColor={colors.text.disabled}
            style={[fieldStyle, { fontSize: typography.sizes.base, color: colors.text.primary }]}
          />
        </View>

        {/* Besonderheiten */}
        {besonderheitenOpen ? (
          <View>
            <Text style={labelStyle}>Besonderheiten</Text>
            <TextInput
              value={form.besonderheiten}
              onChangeText={(v) => set('besonderheiten', v)}
              multiline
              numberOfLines={4}
              placeholder="Optionale Anmerkungen"
              placeholderTextColor={colors.text.disabled}
              style={[
                fieldStyle,
                {
                  fontSize: typography.sizes.base,
                  color: colors.text.primary,
                  minHeight: 96,
                  textAlignVertical: 'top',
                },
              ]}
            />
          </View>
        ) : (
          <Pressable onPress={() => setBesonderheitenOpen(true)}>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.primary }}>
              ＋ Besonderheit hinzufügen
            </Text>
          </Pressable>
        )}

        {/* Validation error */}
        {error && (
          <Text style={{ fontSize: typography.sizes.sm, color: colors.error }}>{error}</Text>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Save button */}
      <View
        style={{
          padding: spacing.base,
          backgroundColor: colors.bg.screen,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: radii.sm,
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: saving ? 0.7 : 1,
          })}
        >
          {saving
            ? <ActivityIndicator color={colors.text.inverse} />
            : <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.text.inverse }}>
                Speichern
              </Text>
          }
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
