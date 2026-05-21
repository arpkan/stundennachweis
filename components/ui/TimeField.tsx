import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeColors, typography, spacing, radii } from '@/theme';
import { DrumColumn } from './DrumColumn';
import { parseTime, formatTime } from '@/utils/format';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

type Props = {
  label: string;
  value: string; // HH:MM
  onChange: (v: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  isInvalid?: boolean;
};

export function TimeField({ label, value, onChange, isOpen, onToggle, isInvalid }: Props) {
  const colors = useThemeColors();
  const { hours, minutes: rawMinutes } = parseTime(value);
  const minutes = Math.round(rawMinutes / 5) * 5 % 60;

  return (
    <View>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: 56,
          paddingHorizontal: spacing.base,
          backgroundColor: colors.bg.card,
          borderWidth: 1,
          borderColor: isInvalid ? colors.error : (isOpen ? colors.primary : colors.border),
          borderRadius: radii.sm,
        })}
      >
        <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
          {label}
        </Text>
        <Text
          style={{
            fontSize: typography.sizes.xl,
            fontWeight: typography.weights.bold,
            color: isOpen ? colors.primary : colors.text.primary,
          }}
        >
          {value}
        </Text>
      </Pressable>

      {isOpen && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.bg.card,
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: colors.primary,
            borderBottomLeftRadius: radii.sm,
            borderBottomRightRadius: radii.sm,
            paddingVertical: spacing.sm,
          }}
        >
          <DrumColumn
            items={HOURS}
            value={hours}
            onChange={(h) => onChange(formatTime(h, minutes))}
            formatter={pad}
            width={80}
          />
          <Text
            style={{
              fontSize: typography.sizes.xxl,
              fontWeight: typography.weights.bold,
              color: colors.text.primary,
              marginHorizontal: spacing.sm,
              marginBottom: 4,
            }}
          >
            :
          </Text>
          <DrumColumn
            items={MINUTES}
            value={minutes}
            onChange={(m) => onChange(formatTime(hours, m))}
            formatter={pad}
            width={80}
          />
        </View>
      )}
    </View>
  );
}
