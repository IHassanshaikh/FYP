// ═══════ VectorBat Premium Light Sports-Tech Palette ═══════

const palette = {
  // Core background layers (Z-depth ordering)
  base: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceElevated: '#F0F2F5',
  surfaceHover: '#E8EBF0',

  // Primary gradient (electric green → cyan)
  gradientStart: '#00C97B',
  gradientEnd: '#00B4D8',
  primary: '#00C97B',

  // Secondary accent (warm amber)
  secondary: '#FF9F1C',

  // Danger / destructive
  danger: '#EF4444',

  // Success / positive
  success: '#22C55E',

  // Warning
  warning: '#F59E0B',

  // Text hierarchy
  textPrimary: '#1A1D23',
  textSecondary: '#3D4350',
  textMuted: '#7C8294',
  textSubtle: '#AEB4C2',

  // Glass / borders
  glassBorder: 'rgba(0,0,0,0.06)',
  glassBorderLight: 'rgba(0,0,0,0.10)',
  glassFill: 'rgba(0,0,0,0.02)',

  // Dividers
  divider: 'rgba(0,0,0,0.06)',
};

const tintColor = palette.primary;

export default {
  light: {
    text: palette.textPrimary,
    background: palette.base,
    tint: tintColor,
    tabIconDefault: palette.textSubtle,
    tabIconSelected: tintColor,
    cardBackground: palette.surface,
    border: palette.glassBorder,
    muted: palette.textMuted,
  },
  dark: {
    text: palette.textPrimary,
    background: palette.base,
    tint: tintColor,
    tabIconDefault: palette.textSubtle,
    tabIconSelected: tintColor,
    cardBackground: palette.surface,
    border: palette.glassBorder,
    muted: palette.textMuted,
  },
  // Semantic shortcuts
  primary: palette.primary,
  secondary: palette.secondary,
  background: palette.base,
  cardBackground: palette.surface,
  // Extended palette exports
  palette,
};
