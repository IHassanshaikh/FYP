import React from 'react';
import { View, StyleSheet, ViewProps, Platform } from 'react-native';
import Colors from '../constants/Colors';

const p = Colors.palette;

interface GlowCardProps extends ViewProps {
  glowColor?: string;
  noPadding?: boolean;
}

export function GlowCard({ style, children, glowColor = 'transparent', noPadding = false, ...props }: GlowCardProps) {
  const isGlowing = glowColor !== 'transparent';
  return (
    <View
      style={[
        styles.card,
        {
          shadowColor: isGlowing ? glowColor : '#000',
          borderColor: isGlowing ? glowColor + '30' : p.glassBorder,
          borderWidth: isGlowing ? 1.5 : 1,
          padding: noPadding ? 0 : 16,
          ...(Platform.OS === 'web' && isGlowing ? {
            boxShadow: `0 2px 16px ${glowColor}20, 0 0 0 1px ${glowColor}15`,
          } : {}),
          ...(Platform.OS === 'web' && !isGlowing ? {
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
          } : {}),
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.palette.surface,
    borderRadius: 16,
    marginVertical: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});
