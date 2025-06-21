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
      backgroundColor: theme.surfaceCard, // Use stronger glass effect
      shadowColor: isDark ? '#000' : '#000',
      borderColor: isDark 
        ? 'rgba(255, 255, 255, 0.15)' 
        : 'rgba(255, 255, 255, 0.4)',
      borderWidth: 1.5, // Thicker border like Control Center
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
      {/* Control Center style glass blur effect */}
      <View 
        style={[
          StyleSheet.absoluteFillObject, 
          { 
            borderRadius,
            backgroundColor: theme.frostedGlass,
          }
        ]} 
      />
      
      {/* Control Center style highlight layer */}
      <View 
        style={[
          styles.highlightLayer,
          { 
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
            backgroundColor: isDark 
              ? 'rgba(255, 255, 255, 0.08)' 
              : 'rgba(255, 255, 255, 0.3)',
          }
        ]} 
      />
      
      {/* Control Center style inner border glow */}
      <View 
        style={[
          StyleSheet.absoluteFillObject, 
          { 
            borderRadius: borderRadius - 2,
            borderWidth: 1,
            borderColor: isDark 
              ? 'rgba(255, 255, 255, 0.2)' 
              : 'rgba(255, 255, 255, 0.6)',
            margin: 2,
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
          height: 16, // Stronger shadow like Control Center
        },
        shadowOpacity: 0.25,
        shadowRadius: 40,
      },
      android: {
        elevation: 20,
      },
    }),
  },
  content: {
    overflow: 'hidden',
    zIndex: 10,
  },
  highlightLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%', // Control Center style highlight
  },
}); 