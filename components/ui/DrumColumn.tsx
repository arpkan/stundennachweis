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

  // Scroll to value when it changes externally
  useEffect(() => {
    if (isScrollingRef.current) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    
    // Only scroll if we are not already at the correct position
    setActiveIdx(idx);
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
  }, [value, items]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
    
    // Immediate local feedback
    setActiveIdx(idx);
    
    // Only trigger change if it actually changed to avoid unnecessary parent re-renders
    if (items[idx] !== value) {
      onChange(items[idx]);
    }
    
    // Small delay before allowing external scrolls again to let parent state settle
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
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
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onScrollBeginDrag={() => { isScrollingRef.current = true; }}
        onMomentumScrollBegin={() => { isScrollingRef.current = true; }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          // On iOS, if there's no momentum, handle it immediately
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
