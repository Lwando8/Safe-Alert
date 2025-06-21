import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface BlurOverlayProps {
  position: 'top' | 'bottom';
  height: number;
  backgroundColor: string;
}

export default function BlurOverlay({ position, height, backgroundColor }: BlurOverlayProps) {
  return (
    <View 
      style={[
        styles.overlay,
        {
          [position]: 0,
          height,
          backgroundColor,
        },
        Platform.OS === 'ios' && styles.iosBlur,
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  iosBlur: {
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  },
}); 