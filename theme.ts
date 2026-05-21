import { useColorScheme } from 'react-native';

const light = {
  primary:        '#1A56DB',
  primaryPressed: '#1344B8',

  bg: {
    screen: '#F5F7FA',
    card:   '#FFFFFF',
    input:  '#FFFFFF',
    subtle: '#EEF1F6',
  },

  text: {
    primary:   '#111827',
    secondary: '#6B7280',
    disabled:  '#9CA3AF',
    inverse:   '#FFFFFF',
    error:     '#DC2626',
  },

  success: '#16A34A',
  warning: '#D97706',
  error:   '#DC2626',
  border:  '#D1D5DB',
  shadow:  'rgba(0,0,0,0.06)',
};

const dark = {
  primary:        '#3B82F6',
  primaryPressed: '#2563EB',

  bg: {
    screen: '#0F172A',
    card:   '#1E293B',
    input:  '#1E293B',
    subtle: '#334155',
  },

  text: {
    primary:   '#F8FAFC',
    secondary: '#94A3B8',
    disabled:  '#475569',
    inverse:   '#FFFFFF',
    error:     '#EF4444',
  },

  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  border:  '#334155',
  shadow:  'rgba(0,0,0,0.3)',
};

// Default export for backward compatibility (defaults to light)
export const colors = light;

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

export const typography = {
  fontFamily: undefined,

  sizes: {
    xs:   12,
    sm:   14,
    base: 16,
    lg:   18,
    xl:   22,
    xxl:  28,
  },

  weights: {
    regular:  '400' as const,
    medium:   '500' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },

  lineHeights: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.75,
  },
}

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   24,
  xl:   32,
  xxl:  48,
}

export const radii = {
  sm:   6,
  md:   12,
  lg:   16,
  pill: 999,
}

export const shadows = {
  card: {
    shadowColor:   '#000', // Keep black for shadows, opacity will handle depth
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius:  8,
    elevation:     3,
  },
  none: {},
}
