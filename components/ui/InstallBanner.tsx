import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Download, X, Share } from 'lucide-react-native';
import { useThemeColors, typography, spacing, radii } from '@/theme';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallBanner({ onIosGuide }: { onIosGuide?: () => void }) {
  const { canInstall, canPrompt, isIos, promptInstall, dismiss } = useInstallPrompt();
  const colors = useThemeColors();

  if (Platform.OS !== 'web' || !canInstall) return null;

  const handleInstall = () => {
    if (isIos) {
      onIosGuide?.();
    } else if (canPrompt) {
      promptInstall();
    } else {
      window.alert('Zum Startbildschirm hinzufügen:\n\n1. Tippe auf das Menü deines Browsers (⋮ oder ☰)\n2. Tippe auf „Mehr"\n3. Wähle „Zum Startbildschirm hinzufügen"\n4. Bestätige mit „Hinzufügen"');
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        backgroundColor: colors.bg.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radii.md,
          backgroundColor: colors.bg.subtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isIos ? (
          <Share size={20} color={colors.primary} pointerEvents="none" />
        ) : (
          <Download size={20} color={colors.primary} pointerEvents="none" />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.text.primary }}>
          App installieren
        </Text>
        <Text style={{ fontSize: typography.sizes.sm, color: colors.text.secondary }}>
          {isIos ? 'Zum Home-Bildschirm hinzufügen' : 'Schneller Zugriff vom Home-Bildschirm'}
        </Text>
      </View>
      <Pressable
        onPress={handleInstall}
        style={({ pressed }) => ({
          backgroundColor: pressed ? colors.primaryPressed : colors.primary,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.sm,
          minHeight: 40,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Text style={{ fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.text.inverse }}>
          {canPrompt || isIos ? 'Installieren' : 'Anleitung'}
        </Text>
      </Pressable>
      <Pressable onPress={dismiss} hitSlop={8}>
        <X size={18} color={colors.text.disabled} pointerEvents="none" />
      </Pressable>
    </View>
  );
}
