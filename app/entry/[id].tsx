import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X } from 'lucide-react-native';

import { useThemeColors, typography, spacing, radii, shadows } from '@/theme';
import { TimeField } from '@/components/ui/TimeField';
import { TourChips } from '@/components/ui/TourChips';
import {
  formatDatum, formatDatumIso, parseDatum,
  calcGesamtzeit, formatGesamtzeit, parseTime,
} from '@/utils/format';
import {
  getTripById, insertTrip, updateTrip,
  getDefaultBeginFahrt, getRecentTourNumbers,
  getAllSettings,
} from '@/db/queries';
import type { NewTrip } from '@/db/types';

type FormState = {
  datum: string;
  datumIso: string;
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
  beginFahrt: '07:00',
  ankunftSchule: '07:30',
  abfahrtSchule: '07:45',
  endeFahrt: '09:00',
  tourNr: '',
  besonderheiten: '',
};

export default function EntryScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const router = useRouter();
  const colors = useThemeColors();

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
            beginFahrt: trip.beginFahrt,
            ankunftSchule: trip.ankunftSchule,
            abfahrtSchule: trip.abfahrtSchule,
            endeFahrt: trip.endeFahrt,
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
          setForm({
            datum: formatDatum(today),
            datumIso: formatDatumIso(today),
            beginFahrt: source.beginFahrt,
            ankunftSchule: source.ankunftSchule,
            abfahrtSchule: source.abfahrtSchule,
            endeFahrt: source.endeFahrt,
            tourNr: source.tourNr,
            besonderheiten: '',
          });
          return;
        }
      }

      const weekday = today.getDay();
      const settings = await getAllSettings(db);
      
      // We check if the user has set a specific name or signature to assume settings are "touched",
      // but more reliably, we just use the values from settings as they have fallbacks.
      const hasUserDefaults = settings.defaultBeginn !== '07:00' || settings.defaultEnde !== '09:00';

      let baseTimes = {
        beginn_fahrt:    settings.defaultBeginn,
        ankunft_schule:  settings.defaultAnkunft,
        abfahrt_schule:  settings.defaultAbfahrt,
        ende_fahrt:      settings.defaultEnde,
      };

      // If user hasn't touched settings, try to find a similar trip from history
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
        datum: formatDatum(today),
        datumIso: formatDatumIso(today),
        beginFahrt:    baseTimes.beginn_fahrt,
        ankunftSchule: baseTimes.ankunft_schule,
        abfahrtSchule: baseTimes.abfahrt_schule,
        endeFahrt:     baseTimes.ende_fahrt,
        tourNr: settings.defaultTour || (recentTours[0] ?? ''),
      });
    }
    load();
  }, []);

  const set = useCallback((field: keyof FormState, value: string) => {
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
    
    // 1. Tour-Nr validation
    if (!form.tourNr.trim()) {
      setError('Bitte geben Sie eine Tour-Nr. ein');
      return;
    }

    // 2. Chronological sequence validation
    const t1 = parseTime(form.beginFahrt).hours * 60 + parseTime(form.beginFahrt).minutes;
    const t2 = parseTime(form.ankunftSchule).hours * 60 + parseTime(form.ankunftSchule).minutes;
    const t3 = parseTime(form.abfahrtSchule).hours * 60 + parseTime(form.abfahrtSchule).minutes;
    const t4 = parseTime(form.endeFahrt).hours * 60 + parseTime(form.endeFahrt).minutes;

    if (t2 < t1) { setError('Ankunft Schule darf nicht vor Beginn liegen'); return; }
    if (t3 < t2) { setError('Abfahrt Schule darf nicht vor Ankunft liegen'); return; }
    if (t4 < t3) { setError('Ende Fahrt darf nicht vor Abfahrt liegen'); return; }

    const gz = t4 - t1;
    if (gz <= 0) {
      setError('Ende Fahrt muss nach Beginn Fahrt liegen');
      return;
    }

    setError(null);
    setSaving(true);
    
    try {
      const today = new Date();
      
      // Ensure we have all required fields even if state is slightly stale
      const finalTrip: NewTrip = {
        datum: form.datum || formatDatum(today),
        datumIso: form.datumIso || formatDatumIso(today),
        beginFahrt: form.beginFahrt,
        ankunftSchule: form.ankunftSchule,
        abfahrtSchule: form.abfahrtSchule,
        endeFahrt: form.endeFahrt,
        gesamtzeit: gz,
        tourNr: form.tourNr.trim(),
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

  const gesamtzeit = calcGesamtzeit(form.beginFahrt, form.endeFahrt);

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
          paddingTop: spacing.xl,
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
          <X size={24} color={colors.text.secondary} />
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
        </View>

        {/* Time fields */}
        {(
          [
            { key: 'beginFahrt',    label: 'Beginn Fahrt' },
            { key: 'ankunftSchule', label: 'Ankunft Schule / Werkstätte' },
            { key: 'abfahrtSchule', label: 'Abfahrt Schule / Werkstätte' },
            { key: 'endeFahrt',     label: 'Ende Fahrt' },
          ] as const
        ).map(({ key, label }, index, array) => {
          // Live check: is this field valid relative to the previous one?
          let hasFieldError = false;
          if (index > 0) {
            const prevKey = array[index - 1].key;
            const tPrev = parseTime(form[prevKey]).hours * 60 + parseTime(form[prevKey]).minutes;
            const tCurr = parseTime(form[key]).hours * 60 + parseTime(form[key]).minutes;
            if (tCurr < tPrev) hasFieldError = true;
          }

          return (
            <View key={key}>
              <Text style={labelStyle}>{label}</Text>
              <TimeField
                label={label}
                value={form[key]}
                onChange={(v) => set(key, v)}
                isOpen={openField === key}
                onToggle={() => handleToggleField(key)}
                isInvalid={hasFieldError}
              />
            </View>
          );
        })}

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

      {/* Save button — outside ScrollView so it stays visible */}
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
