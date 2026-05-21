import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useThemeColors, typography, spacing, radii, shadows } from '@/theme';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

type Props = {
  month: number; // 1–12
  year: number;
  onSelect: (month: number, year: number) => void;
};

export function MonthYearPicker({ month, year, onSelect }: Props) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(year);

  const openSheet = () => {
    setDraftYear(year);
    setOpen(true);
  };

  const select = (m: number) => {
    onSelect(m, draftYear);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={openSheet} hitSlop={8}>
        <Text style={{
          fontSize: typography.sizes.xl,
          fontWeight: typography.weights.bold,
          color: colors.text.primary,
        }}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{
            backgroundColor: colors.bg.card,
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            padding: spacing.lg,
            gap: spacing.lg,
            ...shadows.card,
          }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary }}>
                Monat wählen
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <X size={22} color={colors.text.secondary} pointerEvents="none" />
              </Pressable>
            </View>

            {/* Year selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
              <Pressable
                onPress={() => setDraftYear((y) => y - 1)}
                hitSlop={12}
                style={{ padding: spacing.sm }}
              >
                <ChevronLeft size={26} color={colors.text.primary} pointerEvents="none" />
              </Pressable>
              <Text style={{ fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.text.primary, minWidth: 60, textAlign: 'center' }}>
                {draftYear}
              </Text>
              <Pressable
                onPress={() => setDraftYear((y) => y + 1)}
                hitSlop={12}
                style={{ padding: spacing.sm }}
              >
                <ChevronRight size={26} color={colors.text.primary} pointerEvents="none" />
              </Pressable>
            </View>

            {/* Month grid: 4 columns × 3 rows */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {MONTH_NAMES.map((name, idx) => {
                const m = idx + 1;
                const selected = m === month && draftYear === year;
                return (
                  <Pressable
                    key={m}
                    onPress={() => select(m)}
                    style={({ pressed }) => ({
                      width: '23%',
                      minHeight: 48,
                      borderRadius: radii.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected
                        ? colors.primary
                        : pressed ? colors.bg.subtle : colors.bg.screen,
                      borderWidth: selected ? 0 : 1,
                      borderColor: colors.border,
                    })}
                  >
                    <Text style={{
                      fontSize: typography.sizes.sm,
                      fontWeight: selected ? typography.weights.semibold : typography.weights.regular,
                      color: selected ? colors.text.inverse : colors.text.primary,
                      textAlign: 'center',
                    }}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
