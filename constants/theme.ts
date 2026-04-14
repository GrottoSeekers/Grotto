import { Platform } from 'react-native';

export const GrottoTokens = {
  gold: '#C9A84C',
  goldLight: '#D4AF37',
  goldMuted: '#E8D5A3',
  goldSubtle: '#F5EDD6',
  white: '#FFFFFF',
  offWhite: '#FAF9F6',
  surface: '#F2F0EB',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B6560',
  textMuted: '#9E9890',
  borderSubtle: '#EEECE7',
  shadow: 'rgba(0,0,0,0.08)',
  shadowMedium: 'rgba(0,0,0,0.14)',
  error: '#D44C4C',
  success: '#4CAF7D',
};

export const FontFamily = {
  serifRegular: 'PlayfairDisplay_400Regular',
  serifBold: 'PlayfairDisplay_700Bold',
  sansRegular: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
};

export const Colors = {
  light: {
    text: GrottoTokens.textPrimary,
    background: GrottoTokens.white,
    tint: GrottoTokens.gold,
    icon: GrottoTokens.textSecondary,
    tabIconDefault: GrottoTokens.textMuted,
    tabIconSelected: GrottoTokens.gold,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: GrottoTokens.gold,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: GrottoTokens.gold,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
