import React from 'react';
import { View } from 'react-native';

export type DateTimePickerEvent = {
  type: string;
  nativeEvent: { timestamp: number };
};

type Props = {
  value: Date;
  mode: string;
  display: string;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  maximumDate?: Date;
  locale?: string;
  themeVariant?: string;
  textColor?: string;
};

export function DateTimePicker({ value, onChange, maximumDate }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
    if (date) {
      onChange({ type: 'set', nativeEvent: { timestamp: date.getTime() } }, date);
    }
  };

  return (
    <View style={{ padding: 8 }}>
      <input
        type="date"
        value={value.toISOString().slice(0, 10)}
        onChange={handleChange}
        max={maximumDate?.toISOString().slice(0, 10)}
        style={{
          fontSize: 16,
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #ccc',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </View>
  );
}
