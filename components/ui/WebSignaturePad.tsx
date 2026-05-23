import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import SignaturePad from 'signature_pad';
import { useThemeColors, typography, spacing, radii } from '@/theme';

type Props = {
  visible: boolean;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
};

export function WebSignaturePad({ visible, onSave, onClose }: Props) {
  const colors = useThemeColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) {
      if (padRef.current) {
        padRef.current.off();
        padRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(ratio, ratio);

      padRef.current?.clear();
    };

    const observer = new ResizeObserver(() => {
      resizeCanvas();

      if (!padRef.current) {
        padRef.current = new SignaturePad(canvas, {
          penColor: '#000000',
          backgroundColor: '#ffffff',
          minWidth: 2.5,
          maxWidth: 6,
        });
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (padRef.current) {
        padRef.current.off();
        padRef.current = null;
      }
    };
  }, [visible]);

  const handleSave = useCallback(() => {
    const pad = padRef.current;
    const src = canvasRef.current;
    if (!pad || pad.isEmpty() || !src) return;

    // Normalise to max 600px wide so PDF embedding doesn't shrink strokes to hairlines.
    // Divide by DPR first to get logical dimensions, then cap.
    const ratio = window.devicePixelRatio || 1;
    const logicalW = src.width / ratio;
    const logicalH = src.height / ratio;
    const MAX_W = 600;
    const scale = Math.min(1, MAX_W / logicalW);
    const outW = Math.round(logicalW * scale);
    const outH = Math.round(logicalH * scale);

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, outW, outH);
    onSave(out.toDataURL('image/png'));
  }, [onSave]);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
  }, []);

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>
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
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary }}>
              Abbrechen
            </Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary }}>
              Unterschrift
            </Text>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.text.secondary }}>
              Mit dem Finger oder der Maus zeichnen
            </Text>
          </View>
          <Pressable onPress={handleSave} hitSlop={12}>
            <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.primary }}>
              Speichern
            </Text>
          </Pressable>
        </View>

        <View
          ref={containerRef as any}
          style={{
            flex: 1,
            margin: spacing.base,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: '#ffffff',
            overflow: 'hidden',
            position: 'relative' as any,
          }}
        >
          <canvas
            ref={canvasRef as any}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              touchAction: 'none',
            } as React.CSSProperties}
          />
        </View>

        <View style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.base }}>
          <Pressable
            onPress={handleClear}
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
