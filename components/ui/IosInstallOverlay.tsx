import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useThemeColors, typography, spacing, radii } from '@/theme';

export function IosInstallOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();

  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <View
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 9999,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 80,
      }}
    >
      <View
        style={{
          backgroundColor: colors.bg.card,
          borderRadius: radii.lg,
          padding: spacing.lg,
          width: '90%',
          maxWidth: 400,
          gap: spacing.md,
        }}
      >
        <Text
          style={{
            fontSize: typography.sizes.lg,
            fontWeight: typography.weights.semibold,
            color: colors.text.primary,
            textAlign: 'center',
          }}
        >
          Zum Home-Bildschirm
        </Text>

        <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
          <Step num={1} text="Tippe auf das Teilen-Symbol unten in der Symbolleiste" icon={<ShareIcon color={colors.primary} />} colors={colors} />
          <Step num={2} text={'Wähle \u201EZum Home-Bildschirm\u201C'} icon={<AddToHomeIcon color={colors.primary} />} colors={colors} />
          <Step num={3} text={'Tippe auf \u201EHinzufügen\u201C'} colors={colors} />
        </View>

        <View
          style={{
            padding: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: typography.sizes.sm,
              color: colors.text.secondary,
              lineHeight: typography.sizes.sm * 1.5,
            }}
          >
            Die App wird dann wie eine normale App auf deinem Gerät angezeigt.
          </Text>
        </View>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({
            height: 48,
            borderRadius: radii.sm,
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text
            style={{
              fontSize: typography.sizes.base,
              fontWeight: typography.weights.semibold,
              color: colors.text.inverse,
            }}
          >
            Verstanden
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Step({
  num,
  text,
  icon,
  colors,
}: {
  num: number;
  text: string;
  icon?: React.ReactNode;
  colors: any;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text
          style={{
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.bold,
            color: colors.text.inverse,
          }}
        >
          {num}
        </Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: typography.sizes.base,
          color: colors.text.primary,
          lineHeight: typography.sizes.base * 1.5,
          paddingTop: 3,
        }}
      >
        {text}
      </Text>
      {icon ? (
        <View style={{ flexShrink: 0, paddingTop: 2 }}>{icon}</View>
      ) : null}
    </View>
  );
}

function ShareIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="4" y="14" width="28" height="20" rx="4" stroke={color} strokeWidth="2.5" />
        <path d="M18 4L18 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M12 9L18 3L24 9" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Text style={{ fontSize: 10, color }}>Teilen</Text>
    </View>
  );
}

function AddToHomeIcon({ color }: { color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="4" y="4" width="28" height="28" rx="6" stroke={color} strokeWidth="2" />
        <path d="M18 11V25" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M11 18H25" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <Text style={{ fontSize: 9, color, textAlign: 'center' }}>{'Zum Home-\nBildschirm'}</Text>
    </View>
  );
}
