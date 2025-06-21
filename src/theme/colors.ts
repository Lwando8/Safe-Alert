export const lightTheme = {
  // Background colors - iOS Control Center Glass Aesthetic
  background: '#f5f5f7', // Soft neutral background
  backgroundSecondary: '#fafafa',
  surface: 'rgba(255, 255, 255, 0.75)', // Strong glass effect like Control Center
  surfaceCard: 'rgba(255, 255, 255, 0.85)', // More opaque glass cards
  card: 'rgba(255, 255, 255, 0.8)', // Strong translucent bars
  
  // Control Center glass overlay effects
  glassOverlay: 'rgba(255, 255, 255, 0.25)', // Strong glass overlay
  glassBlur: 'rgba(255, 255, 255, 0.15)', // Prominent blur effect
  frostedGlass: 'rgba(255, 255, 255, 0.6)', // Strong frost effect
  
  // Text colors with enhanced contrast for readability
  text: '#1d1d1f', // Apple's refined black
  textSecondary: '#6e6e73', // Subtle gray
  textTertiary: '#8e8e93', // Lighter gray
  textOnPrimary: '#ffffff',
  textOnGlass: '#1d1d1f',
  
  // Vibrant button colors that pop against muted background
  primary: '#E67E62', // Keep vibrant for buttons
  primaryGlass: 'rgba(230, 126, 98, 0.9)', // Keep buttons more opaque
  primaryActive: '#cc4400',
  primaryGradient: ['#E67E62', '#ff6b47'], // Vibrant gradient
  
  // Deep burgundy for SOS button
  emergency: '#8B1538', // Deep burgundy
  emergencyGlass: 'rgba(139, 21, 56, 0.95)', // Deep burgundy with high opacity
  emergencyActive: '#6B0F2A',
  emergencyGradient: ['#8B1538', '#A91B47', '#6B0F2A'], // Deep burgundy gradient
  
  // System colors - keep vibrant for buttons and icons
  hospital: '#30d158', // Apple's green - keep vibrant
  hospitalGlass: 'rgba(48, 209, 88, 0.8)', // Keep button backgrounds opaque
  security: '#007aff', // Apple's blue - keep vibrant
  securityGlass: 'rgba(0, 122, 255, 0.8)', // Keep button backgrounds opaque
  location: '#32d74b', // Active green - keep vibrant
  locationGlass: 'rgba(50, 215, 75, 0.8)', // Keep button backgrounds opaque
  
  // SOS Button - Vibrant Red to match app icon (updated)
  contact: '#E53935', // Material Design Red 600 - vibrant red like app icon
  contactGlass: 'rgba(229, 57, 53, 0.9)', // High opacity for strong SOS button
  contactActive: '#C62828', // Darker red for pressed state
  
  // Sky blue for contacts
  skyBlue: '#87CEEB', // Sky blue
  skyBlueGlass: 'rgba(135, 206, 235, 0.8)', // Sky blue with opacity
  profile: '#af52de', // Apple's purple - keep vibrant
  profileGlass: 'rgba(175, 82, 222, 0.8)', // Keep button backgrounds opaque
  monitor: '#ff9500', // Apple's orange - keep vibrant
  monitorGlass: 'rgba(255, 149, 0, 0.8)', // Keep button backgrounds opaque
  
  // UI elements with muted effects
  border: 'rgba(0, 0, 0, 0.05)', // Very soft borders
  borderGlass: 'rgba(255, 255, 255, 0.2)', // Subtle glass borders
  shadow: 'rgba(0, 0, 0, 0.02)', // Very soft shadows
  shadowMedium: 'rgba(0, 0, 0, 0.04)',
  shadowStrong: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  
  // Enhanced gradient backgrounds
  backgroundGradient: ['#f5f5f7', '#ffffff'],
  cardGradient: ['rgba(255, 255, 255, 0.4)', 'rgba(255, 255, 255, 0.25)'],
  emergencyGradient: ['#E67E62', '#ff6b47', '#ff8a65'],
  
  // Muted liquid glass effects
  liquidGlass: 'rgba(255, 255, 255, 0.12)', // Very subtle
  liquidGlassHover: 'rgba(255, 255, 255, 0.2)', // Slightly more visible on interaction
  liquidBorder: 'rgba(255, 255, 255, 0.25)',
};

export const darkTheme = {
  // Background colors - iOS Control Center Dark Glass Aesthetic
  background: '#000000', // Pure black for OLED
  backgroundSecondary: '#0a0a0a',
  surface: 'rgba(28, 28, 30, 0.75)', // Strong dark glass effect
  surfaceCard: 'rgba(44, 44, 46, 0.85)', // More opaque dark glass cards
  card: 'rgba(28, 28, 30, 0.8)', // Strong translucent dark bars
  
  // Control Center dark glass overlay effects
  glassOverlay: 'rgba(255, 255, 255, 0.15)', // Strong glass overlay for dark
  glassBlur: 'rgba(255, 255, 255, 0.08)', // Prominent blur effect for dark
  frostedGlass: 'rgba(28, 28, 30, 0.6)', // Strong dark frost effect
  
  // Text colors for dark mode
  text: '#f2f2f7', // Apple's refined white
  textSecondary: '#aeaeb2', // Subtle light gray
  textTertiary: '#8e8e93', // Medium gray
  textOnPrimary: '#ffffff',
  textOnGlass: '#f2f2f7',
  
  // Vibrant button colors for dark mode
  primary: '#E67E62', // Keep vibrant
  primaryGlass: 'rgba(230, 126, 98, 0.9)', // Keep buttons opaque
  primaryActive: '#ff6b47',
  primaryGradient: ['#E67E62', '#ff6b47'],
  
  // Deep burgundy for SOS button (dark mode)
  emergency: '#A91B47', // Slightly brighter burgundy for dark mode
  emergencyGlass: 'rgba(169, 27, 71, 0.95)', // Deep burgundy with high opacity
  emergencyActive: '#8B1538',
  emergencyGradient: ['#A91B47', '#C12454', '#8B1538'], // Deep burgundy gradient
  
  // System colors for dark mode - keep vibrant
  hospital: '#30d158', // Keep vibrant
  hospitalGlass: 'rgba(48, 209, 88, 0.8)', // Keep button backgrounds opaque
  security: '#0a84ff', // Brighter blue for dark - keep vibrant
  securityGlass: 'rgba(10, 132, 255, 0.8)', // Keep button backgrounds opaque
  location: '#32d74b', // Keep vibrant
  locationGlass: 'rgba(50, 215, 75, 0.8)', // Keep button backgrounds opaque
  
  // SOS Button - Vibrant Red to match app icon (dark mode, updated)
  contact: '#F44336', // Slightly brighter red for dark mode visibility
  contactGlass: 'rgba(244, 67, 54, 0.9)', // High opacity for strong SOS button
  contactActive: '#E53935', // Red 600 for pressed state
  
  // Sky blue for contacts (dark mode)
  skyBlue: '#87CEEB', // Sky blue
  skyBlueGlass: 'rgba(135, 206, 235, 0.8)', // Sky blue with opacity
  profile: '#bf5af2', // Brighter purple for dark - keep vibrant
  profileGlass: 'rgba(191, 90, 242, 0.8)', // Keep button backgrounds opaque
  monitor: '#ff9f0a', // Brighter orange for dark - keep vibrant
  monitorGlass: 'rgba(255, 159, 10, 0.8)', // Keep button backgrounds opaque
  
  // UI elements with muted dark effects
  border: 'rgba(255, 255, 255, 0.05)', // Very soft borders
  borderGlass: 'rgba(255, 255, 255, 0.15)', // Subtle glass borders
  shadow: 'rgba(0, 0, 0, 0.15)', // Soft shadows
  shadowMedium: 'rgba(0, 0, 0, 0.25)',
  shadowStrong: 'rgba(0, 0, 0, 0.35)',
  overlay: 'rgba(0, 0, 0, 0.6)',
  
  // Enhanced dark gradient backgrounds
  backgroundGradient: ['#000000', '#0a0a0a'],
  cardGradient: ['rgba(28, 28, 30, 0.4)', 'rgba(44, 44, 46, 0.25)'],
  emergencyGradient: ['#E67E62', '#ff6b47', '#ff8a65'],
  
  // Muted liquid glass effects for dark mode
  liquidGlass: 'rgba(255, 255, 255, 0.08)', // Very subtle
  liquidGlassHover: 'rgba(255, 255, 255, 0.15)', // Slightly more visible on interaction
  liquidBorder: 'rgba(255, 255, 255, 0.15)',
};

export type Theme = typeof lightTheme; 