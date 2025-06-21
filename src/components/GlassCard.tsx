import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  borderRadius?: number;
  padding?: number;
  margin?: number;
}

export default function GlassCard({
  children,
  style,
  intensity = 20,
  tint = 'default',
  borderRadius = 20,
  padding = 20,
  margin = 0,
}: GlassCardProps) {
  const { theme, isDark } = useTheme();

  const containerStyle = [
    styles.container,
    {
      borderRadius,
      margin,
      backgroundColor: theme.surface,
      shadowColor: isDark ? theme.shadowStrong : theme.shadow,
      borderColor: theme.liquidBorder,
      borderWidth: 1,
    },
    style,
  ];

  const contentStyle = [
    styles.content,
    {
      padding,
      borderRadius: borderRadius - 2,
    },
  ];

  return (
    <View style={containerStyle}>
      {/* Primary glass effect layer */}
      <View 
        style={[
          StyleSheet.absoluteFillObject, 
          { 
            borderRadius,
            backgroundColor: theme.liquidGlass,
          }
        ]} 
      />
      
      {/* Secondary highlight layer for depth */}
      <View 
        style={[
          StyleSheet.absoluteFillObject, 
          { 
            borderRadius,
            backgroundColor: isDark 
              ? 'rgba(255, 255, 255, 0.05)' 
              : 'rgba(255, 255, 255, 0.2)',
            transform: [{ translateY: -1 }],
          }
        ]} 
      />
      
      {/* Inner glow effect */}
      <View 
        style={[
          StyleSheet.absoluteFillObject, 
          { 
            borderRadius: borderRadius - 1,
            borderWidth: 1,
            borderColor: isDark 
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(255, 255, 255, 0.5)',
            margin: 1,
          }
        ]} 
      />
      
      <View style={contentStyle}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowOffset: {
          width: 0,
          height: 8,
        },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  content: {
    overflow: 'hidden',
    zIndex: 10,
  },
}); 