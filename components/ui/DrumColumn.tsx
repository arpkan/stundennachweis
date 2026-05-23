import React, { useRef, useState, useEffect } from 'react';
import { ScrollView, View, Text, Platform, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useThemeColors, typography } from '@/theme';

const ITEM_H = 60;
const VISIBLE = 3;

type Props = {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  formatter: (n: number) => string;
  width: number;
};

export function DrumColumn({ items, value, onChange, formatter, width }: Props) {
  const colors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, items.indexOf(value)));
  const isScrollingRef = useRef(false);
  const webScrollY = useRef(0);
  const webScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isProgrammatic = useRef(false);

  // Scroll to value when it changes externally
  useEffect(() => {
    if (isScrollingRef.current) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    setActiveIdx(idx);
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
  }, [value, items]);

  const commitIdx = (idx: number) => {
    setActiveIdx(idx);
    if (items[idx] !== value) onChange(items[idx]);
    setTimeout(() => { isScrollingRef.current = false; }, 100);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    commitIdx(Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H))));
  };

  return (
    <View style={{ width, height: ITEM_H * VISIBLE, overflow: 'hidden' }}>
      {/* selection highlight */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_H,
          left: 4,
          right: 4,
          height: ITEM_H,
          backgroundColor: colors.bg.subtle,
          borderRadius: 8,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={Platform.OS !== 'web' ? ITEM_H : undefined}
        decelerationRate={Platform.OS !== 'web' ? 'fast' : undefined}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onScrollBeginDrag={() => { isScrollingRef.current = true; }}
        onMomentumScrollBegin={() => { isScrollingRef.current = true; }}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={Platform.OS === 'web' ? 16 : undefined}
        onScroll={Platform.OS === 'web' ? (e) => {
          if (isProgrammatic.current) return;
          isScrollingRef.current = true;
          webScrollY.current = e.nativeEvent.contentOffset.y;
          if (webScrollTimer.current) clearTimeout(webScrollTimer.current);
          webScrollTimer.current = setTimeout(() => {
            const idx = Math.max(0, Math.min(items.length - 1, Math.round(webScrollY.current / ITEM_H)));
            setActiveIdx(idx);
            if (items[idx] !== value) onChange(items[idx]);
            isProgrammatic.current = true;
            scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true });
            setTimeout(() => {
              isProgrammatic.current = false;
              isScrollingRef.current = false;
            }, 300);
          }, 150);
        } : undefined}
        onScrollEndDrag={(e) => {
          if (Platform.OS === 'ios' && Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.1) {
            handleScrollEnd(e);
          } else if (Platform.OS === 'android') {
            handleScrollEnd(e);
          }
        }}
      >
        {items.map((item, i) => (
          <View key={item} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: typography.sizes.xl,
                fontWeight: i === activeIdx ? typography.weights.bold : typography.weights.regular,
                color: i === activeIdx ? colors.primary : colors.text.secondary,
              }}
            >
              {formatter(item)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
