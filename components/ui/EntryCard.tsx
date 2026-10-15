import React, { useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Trash2 } from 'lucide-react-native';
import { useThemeColors, typography, spacing, radii, shadows } from '@/theme';
import { formatGesamtzeit, formatZeitraum } from '@/utils/format';
import type { Trip } from '@/db/types';

type Props = {
  trip: Trip;
  onEdit: () => void;
  onDeleteRequest: () => void;
};

function RightAction({ onPress, colors }: { onPress: () => void; colors: any }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        marginVertical: spacing.xs,
        borderTopRightRadius: radii.md,
        borderBottomRightRadius: radii.md,
      }}
    >
      <Trash2 size={22} color={colors.text.inverse} pointerEvents="none" />
      <Text style={{ fontSize: typography.sizes.xs, color: colors.text.inverse, marginTop: 2 }}>
        Löschen
      </Text>
    </Pressable>
  );
}

export function EntryCard({ trip, onEdit, onDeleteRequest }: Props) {
  const colors = useThemeColors();
  const swipeRef = useRef<Swipeable>(null);

  const handleDeleteRequest = () => {
    swipeRef.current?.close();
    onDeleteRequest();
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => <RightAction onPress={handleDeleteRequest} colors={colors} />}
      overshootRight={false}
    >
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
          borderRadius: radii.md,
          padding: spacing.base,
          minHeight: 64,
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.card,
        })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: 2 }}>
              {trip.datum}
            </Text>
            <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.text.primary }}>
              Tour {trip.tourNr}
            </Text>
            <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 }}>
              {formatZeitraum(trip.beginFahrt, trip.ankunftSchule, trip.abfahrtSchule, trip.endeFahrt)}
            </Text>
          </View>
          <Text
            style={{
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.semibold,
              color: colors.primary,
              marginLeft: spacing.base,
              marginTop: 2,
            }}
          >
            {formatGesamtzeit(trip.gesamtzeit)}
          </Text>
        </View>
        {trip.besonderheiten ? (
          <Text
            numberOfLines={1}
            style={{ fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: spacing.xs }}
          >
            {trip.besonderheiten}
          </Text>
        ) : null}
      </Pressable>
    </Swipeable>
  );
}
