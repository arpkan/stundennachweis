import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { X, Info } from 'lucide-react-native';
import { useThemeColors, typography, spacing, radii } from '@/theme';

const DISMISSED_KEY = 'data-info-banner-dismissed';

export function DataInfoBanner() {
  const colors = useThemeColors();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch {}
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.md,
        backgroundColor: colors.bg.card,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Info size={18} color={colors.warning} pointerEvents="none" style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize: typography.sizes.sm, color: colors.text.secondary, lineHeight: typography.sizes.sm * 1.6 }}>
        Deine Daten werden nur lokal auf diesem Gerät gespeichert. Verwende regelmäßig „Daten exportieren", um ein Backup zu erstellen.
      </Text>
      <Pressable onPress={dismiss} hitSlop={8}>
        <X size={18} color={colors.text.disabled} pointerEvents="none" />
      </Pressable>
    </View>
  );
}
