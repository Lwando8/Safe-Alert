export const lightTheme = {
  // Background colors - iOS 26 Muted Aesthetic
  background: '#f5f5f7', // Soft neutral background
  backgroundSecondary: '#fafafa',
  surface: 'rgba(255, 255, 255, 0.35)', // Much more muted for iOS 26 style
  surfaceCard: 'rgba(255, 255, 255, 0.25)', // Very subtle glass cards
  card: 'rgba(255, 255, 255, 0.25)', // More translucent for bars
  
  // Muted glass overlay effects
  glassOverlay: 'rgba(255, 255, 255, 0.08)', // Very subtle for muted look
  glassBlur: 'rgba(255, 255, 255, 0.04)', // Extremely subtle blur
  frostedGlass: 'rgba(255, 255, 255, 0.2)', // Muted frost
  
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
  contact: '#DC143C', // Scarlet red - vibrant for SOS
  contactGlass: 'rgba(220, 20, 60, 0.8)', // Scarlet red with opacity
  
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
  // Background colors - iOS 26 Dark Muted Aesthetic
  background: '#000000', // Pure black for OLED
  backgroundSecondary: '#0a0a0a',
  surface: 'rgba(28, 28, 30, 0.35)', // Much more muted dark glass
  surfaceCard: 'rgba(44, 44, 46, 0.25)', // Very subtle dark glass cards
  card: 'rgba(28, 28, 30, 0.25)', // More translucent for bars
  
  // Muted dark glass overlay effects
  glassOverlay: 'rgba(255, 255, 255, 0.04)', // Very subtle for muted look
  glassBlur: 'rgba(255, 255, 255, 0.02)', // Extremely subtle blur
  frostedGlass: 'rgba(28, 28, 30, 0.2)', // Muted frost
  
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
  contact: '#FF6347', // Tomato red for dark mode - vibrant for SOS
  contactGlass: 'rgba(255, 99, 71, 0.8)', // Tomato red with opacity
  
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