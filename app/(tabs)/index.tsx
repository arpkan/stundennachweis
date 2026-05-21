import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, Modal, ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';

import { useThemeColors, typography, spacing, radii, shadows } from '@/theme';
import { EntryCard } from '@/components/ui/EntryCard';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { getTripsForMonth, deleteTrip } from '@/db/queries';
import { seedSampleData } from '@/db/seed';
import { formatGesamtzeit } from '@/utils/format';
import type { Trip } from '@/db/types';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const now = new Date();
  const colors = useThemeColors();

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const data = await getTripsForMonth(db, month, year);
    setTrips([...data].reverse()); // descending: most recent first
    setLoading(false);
  }, [db, month, year]);

  useFocusEffect(useCallback(() => { loadTrips(); }, [loadTrips]));

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

  const handleSeed = async () => {
    await seedSampleData(db);
    loadTrips();
  };

  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    await deleteTrip(db, pendingDeleteId);
    setPendingDeleteId(null);
    loadTrips();
  };

  const totalMinutes = trips.reduce((sum, t) => sum + t.gesamtzeit, 0);

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
          <ChevronLeft size={24} color={colors.text.primary} />
        </Pressable>
        <MonthYearPicker month={month} year={year} onSelect={handlePickMonth} />
        <Pressable onPress={nextMonth} hitSlop={12}>
          <ChevronRight size={24} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* Trip list */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(t) => String(t.id)}
          contentContainerStyle={{
            padding: spacing.base,
            gap: spacing.sm,
            paddingBottom: 160,
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.lg }}>
              <Text style={{ fontSize: typography.sizes.lg, color: colors.text.secondary }}>
                Noch keine Fahrten in diesem Monat
              </Text>
              <Pressable
                onPress={handleSeed}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
                })}
              >
                <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                  Testdaten laden
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <EntryCard
              trip={item}
              onEdit={() => router.push(`/entry/${item.id}`)}
              onDeleteRequest={() => setPendingDeleteId(item.id)}
            />
          )}
          ListFooterComponent={__DEV__ ? (
            <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
              <Pressable
                onPress={handleSeed}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
                })}
              >
                <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
                  Testdaten laden
                </Text>
              </Pressable>
            </View>
          ) : null}
        />
      )}

      {/* Sticky total footer */}
      {trips.length > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 24,
            left: spacing.base,
            right: spacing.base,
            backgroundColor: colors.primary,
            borderRadius: radii.md,
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            ...shadows.card,
          }}
        >
          <View>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.text.inverse, fontWeight: typography.weights.medium }}>
              Monats-Gesamtzeit
            </Text>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.text.inverse, opacity: 0.8 }}>
              Alle Fahrten in diesem Monat
            </Text>
          </View>
          <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.text.inverse }}>
            {formatGesamtzeit(totalMinutes)}
          </Text>
        </View>
      )}

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/entry/new')}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: trips.length > 0 ? 104 : 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: radii.pill,
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.card,
        })}
      >
        <Plus size={28} color={colors.text.inverse} />
      </Pressable>

      {/* Delete confirmation */}
      <Modal visible={pendingDeleteId !== null} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View
            style={{
              backgroundColor: colors.bg.card,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary, textAlign: 'center' }}>
              Eintrag löschen?
            </Text>
            <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary, textAlign: 'center' }}>
              Dieser Eintrag wird endgültig entfernt.
            </Text>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: pressed ? '#b91c1c' : colors.error,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.text.inverse }}>
                Löschen
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPendingDeleteId(null)}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: radii.sm,
                backgroundColor: pressed ? colors.bg.subtle : colors.bg.screen,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text style={{ fontSize: typography.sizes.base, color: colors.text.primary }}>
                Abbrechen
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
