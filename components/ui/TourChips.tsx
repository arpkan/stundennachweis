import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeColors, typography, spacing, radii } from '@/theme';

type Props = {
  chips: string[];
  selected: string;
  onSelect: (v: string) => void;
};

export function TourChips({ chips, selected, onSelect }: Props) {
  const colors = useThemeColors();
  if (chips.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
      {chips.map((chip) => {
        const active = chip === selected;
        return (
          <Pressable
            key={chip}
            onPress={() => onSelect(chip)}
            style={{
              minWidth: 48,
              height: 48,
              paddingHorizontal: spacing.md,
              borderRadius: radii.pill,
              borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.bg.subtle : colors.bg.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: typography.sizes.base,
                fontWeight: active ? typography.weights.semibold : typography.weights.regular,
                color: active ? colors.primary : colors.text.primary,
              }}
            >
              {chip}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
