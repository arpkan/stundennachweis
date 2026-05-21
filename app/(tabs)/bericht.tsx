import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react-native';

import { useThemeColors, typography, spacing, radii } from '@/theme';
import { getTripsForMonth, getAllSettings } from '@/db/queries';
import { buildReportHtml, generatePdf } from '@/utils/generatePdf';
import { formatGesamtzeit } from '@/utils/format';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import type { Trip } from '@/db/types';
import type { Settings } from '@/db/types';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export default function BerichtScreen() {
  const db = useSQLiteContext();
  const now = new Date();
  const colors = useThemeColors();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, s] = await Promise.all([
      getTripsForMonth(db, month, year),
      getAllSettings(db),
    ]);
    setTrips(data);
    setSettings(s);
    setLoading(false);
  }, [db, month, year]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const handlePickMonth = (m: number, y: number) => {
    setMonth(m);
    setYear(y);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const uri = await generatePdf(trips, settings!, month, year);
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Stundennachweis ${MONTH_NAMES[month - 1]} ${year}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Fehler', `PDF konnte nicht erstellt werden.\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  };

  const totalMinutes = trips.reduce((sum, t) => sum + t.gesamtzeit, 0);
  const previewHtml = settings ? buildReportHtml(trips, settings, month, year) : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>

      {/* Month selector */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.base,
          paddingVertical: spacing.md,
          backgroundColor: colors.bg.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={prevMonth} hitSlop={12}>
          <ChevronLeft size={24} color={colors.text.primary} pointerEvents="none" />
        </Pressable>
        <MonthYearPicker month={month} year={year} onSelect={handlePickMonth} />
        <Pressable onPress={nextMonth} hitSlop={12}>
          <ChevronRight size={24} color={colors.text.primary} pointerEvents="none" />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : trips.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: typography.sizes.lg, color: colors.text.secondary }}>
            Keine Fahrten in diesem Monat
          </Text>
        </View>
      ) : (
        <>
          {/* Summary bar */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
              backgroundColor: colors.bg.subtle,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
              {trips.length} {trips.length === 1 ? 'Fahrt' : 'Fahrten'}
            </Text>
            <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.primary }}>
              Gesamt: {formatGesamtzeit(totalMinutes)}
            </Text>
          </View>

          {/* HTML preview */}
          <WebView
            source={{ html: previewHtml }}
            style={{ flex: 1 }}
            scrollEnabled
            originWhitelist={['*']}
          />
        </>
      )}

      {/* Send button */}
      {trips.length > 0 && (
        <View
          style={{
            padding: spacing.base,
            backgroundColor: colors.bg.screen,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <Pressable
            onPress={handleSend}
            disabled={sending}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: radii.sm,
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              opacity: sending ? 0.7 : 1,
            })}
          >
            {sending
              ? <ActivityIndicator color={colors.text.inverse} />
              : <>
                  <Send size={20} color={colors.text.inverse} pointerEvents="none" />
                  <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.text.inverse }}>
                    Bericht senden
                  </Text>
                </>
            }
          </Pressable>
        </View>
      )}
    </View>
  );
}
