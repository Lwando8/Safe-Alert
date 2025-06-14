export const lightTheme = {
  // Background colors
  background: '#ffffff',
  surface: '#f8f8f8',
  card: '#ffffff',
  
  // Text colors
  text: '#333333',
  textSecondary: '#666666',
  textOnPrimary: '#ffffff',
  
  // Primary emergency colors
  primary: '#E67E62', // Coral emergency button
  primaryActive: '#cc0000',
  
  // Action colors
  hospital: '#4CAF50', // Green
  security: '#2196F3', // Blue
  location: '#2ECC71', // Active green
  contact: '#E74C3C', // Red
  profile: '#8E44AD', // Purple
  monitor: '#F39C12', // Orange
  
  // UI elements
  border: '#eeeeee',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const darkTheme = {
  // Background colors
  background: '#121212',
  surface: '#1e1e1e',
  card: '#2d2d2d',
  
  // Text colors
  text: '#ffffff',
  textSecondary: '#cccccc',
  textOnPrimary: '#ffffff',
  
  // Primary emergency colors (keeping coral for brand consistency)
  primary: '#E67E62',
  primaryActive: '#ff4444',
  
  // Action colors (slightly adjusted for dark mode)
  hospital: '#66BB6A', // Lighter green
  security: '#42A5F5', // Lighter blue
  location: '#4DD0E1', // Cyan
  contact: '#EF5350', // Lighter red
  profile: '#AB47BC', // Lighter purple
  monitor: '#FFCA28', // Lighter orange
  
  // UI elements
  border: '#404040',
  shadow: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

export type Theme = typeof lightTheme; 