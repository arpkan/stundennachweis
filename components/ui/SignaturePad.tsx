import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import SignatureCanvas, { type SignatureViewRef } from 'react-native-signature-canvas';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useThemeColors, typography, spacing, radii } from '@/theme';

type Props = {
  visible: boolean;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
};

export function SignaturePad({ visible, onSave, onClose }: Props) {
  const colors = useThemeColors();
  const sigRef = useRef<SignatureViewRef>(null);

  // The signature canvas captures its dimensions once on mount. It must only
  // mount after the rotation to landscape has settled, otherwise it measures
  // portrait size and drawn strokes land offset from the finger.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (visible) {
      setReady(false);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).then(() => {
        setTimeout(() => {
          if (!cancelled) setReady(true);
        }, 350);
      });
    } else {
      setReady(false);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
    return () => {
      cancelled = true;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, [visible]);

  const handleClose = () => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    onClose();
  };

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; width: 100%; height: 100%; }
    .m-signature-pad--body { border: none; width: 100%; height: 100%; }
    .m-signature-pad--footer { display: none; }
    body { margin: 0; background: #fff; }
  `;

  return (
    <Modal visible={visible} animationType="slide" supportedOrientations={['landscape']}>
      <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>

        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: colors.bg.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary }}>
              Abbrechen
            </Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary }}>
              Unterschrift
            </Text>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.text.secondary }}>
              Mit dem Finger in das Feld zeichnen
            </Text>
          </View>
          <Pressable onPress={() => sigRef.current?.readSignature()} hitSlop={12}>
            <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.primary }}>
              Speichern
            </Text>
          </Pressable>
        </View>

        {/* Canvas — takes all remaining space in landscape */}
        <View
          style={{
            flex: 1,
            margin: spacing.base,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: colors.bg.card,
            overflow: 'hidden',
          }}
        >
          {ready ? (
            <SignatureCanvas
              ref={sigRef}
              onOK={onSave}
              onEmpty={() => {}}
              webStyle={webStyle}
              penColor="#000000"
              backgroundColor="#ffffff"
              autoClear={false}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </View>

        {/* Clear button */}
        <View style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.base }}>
          <Pressable
            onPress={() => sigRef.current?.clearSignature()}
            style={({ pressed }) => ({
              height: 44,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary }}>
              Löschen
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
