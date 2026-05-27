export const lightTheme = {
  background: '#f2f2f7',
  backgroundSecondary: '#fafafa',
  surface: 'rgba(255, 255, 255, 0.82)',
  surfaceCard: 'rgba(255, 255, 255, 0.92)',
  card: 'rgba(255, 255, 255, 0.95)',

  glassOverlay: 'rgba(255, 255, 255, 0.25)',
  glassBlur: 'rgba(255, 255, 255, 0.15)',
  frostedGlass: 'rgba(255, 255, 255, 0.55)',

  text: '#1c1c1e',
  textSecondary: '#636366',
  textTertiary: '#8e8e93',
  textOnPrimary: '#ffffff',
  textOnGlass: '#1c1c1e',

  // Muted brand & actions
  primary: '#B07A5F',
  primaryGlass: 'rgba(176, 122, 95, 0.18)',
  primaryActive: '#946654',
  primaryGradient: ['#B07A5F', '#C4927A'],

  emergency: '#9B3D52',
  emergencyGlass: 'rgba(155, 61, 82, 0.2)',
  emergencyActive: '#7E3244',
  emergencyGradient: ['#9B3D52', '#B04A62', '#7E3244'],

  hospital: '#4F8F6A',
  hospitalGlass: 'rgba(79, 143, 106, 0.18)',
  security: '#4A6F8C',
  securityGlass: 'rgba(74, 111, 140, 0.18)',
  location: '#4A8260',
  locationGlass: 'rgba(74, 130, 96, 0.18)',

  contact: '#9B3D52',
  contactGlass: 'rgba(155, 61, 82, 0.18)',
  contactActive: '#7E3244',

  skyBlue: '#5F8499',
  skyBlueGlass: 'rgba(95, 132, 153, 0.18)',
  profile: '#7A6B94',
  profileGlass: 'rgba(122, 107, 148, 0.18)',
  monitor: '#A67B45',
  monitorGlass: 'rgba(166, 123, 69, 0.18)',

  border: 'rgba(0, 0, 0, 0.08)',
  borderGlass: 'rgba(255, 255, 255, 0.35)',
  shadow: 'rgba(0, 0, 0, 0.04)',
  shadowMedium: 'rgba(0, 0, 0, 0.06)',
  shadowStrong: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.4)',

  backgroundGradient: ['#f2f2f7', '#ffffff'],
  gradient: ['#f2f2f7', '#ffffff'],
  cardGradient: ['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.35)'],
  accentGradient: ['#B07A5F', '#C4927A', '#D4A88E'],
  sosButton: '#9B3D52',
  glassBg: 'rgba(255, 255, 255, 0.82)',

  liquidGlass: 'rgba(0, 0, 0, 0.04)',
  liquidGlassHover: 'rgba(0, 0, 0, 0.06)',
  liquidBorder: 'rgba(0, 0, 0, 0.1)',
};

export const darkTheme = {
  background: '#000000',
  backgroundSecondary: '#0a0a0a',
  surface: 'rgba(28, 28, 30, 0.82)',
  surfaceCard: 'rgba(44, 44, 46, 0.92)',
  card: 'rgba(28, 28, 30, 0.95)',

  glassOverlay: 'rgba(255, 255, 255, 0.1)',
  glassBlur: 'rgba(255, 255, 255, 0.06)',
  frostedGlass: 'rgba(28, 28, 30, 0.55)',

  text: '#f2f2f7',
  textSecondary: '#aeaeb2',
  textTertiary: '#8e8e93',
  textOnPrimary: '#ffffff',
  textOnGlass: '#f2f2f7',

  primary: '#C4927A',
  primaryGlass: 'rgba(196, 146, 122, 0.22)',
  primaryActive: '#D4A88E',
  primaryGradient: ['#C4927A', '#D4A88E'],

  emergency: '#B04A62',
  emergencyGlass: 'rgba(176, 74, 98, 0.25)',
  emergencyActive: '#9B3D52',
  emergencyGradient: ['#B04A62', '#C45A72', '#9B3D52'],

  hospital: '#5FA67E',
  hospitalGlass: 'rgba(95, 166, 126, 0.22)',
  security: '#6B8FAD',
  securityGlass: 'rgba(107, 143, 173, 0.22)',
  location: '#5FA67E',
  locationGlass: 'rgba(95, 166, 126, 0.22)',

  contact: '#B04A62',
  contactGlass: 'rgba(176, 74, 98, 0.22)',
  contactActive: '#9B3D52',

  skyBlue: '#7A9DB3',
  skyBlueGlass: 'rgba(122, 157, 179, 0.22)',
  profile: '#9A8AB5',
  profileGlass: 'rgba(154, 138, 181, 0.22)',
  monitor: '#C49A5C',
  monitorGlass: 'rgba(196, 154, 92, 0.22)',

  border: 'rgba(255, 255, 255, 0.1)',
  borderGlass: 'rgba(255, 255, 255, 0.15)',
  shadow: 'rgba(0, 0, 0, 0.2)',
  shadowMedium: 'rgba(0, 0, 0, 0.3)',
  shadowStrong: 'rgba(0, 0, 0, 0.4)',
  overlay: 'rgba(0, 0, 0, 0.6)',

  backgroundGradient: ['#000000', '#0a0a0a'],
  gradient: ['#000000', '#0a0a0a'],
  cardGradient: ['rgba(28, 28, 30, 0.5)', 'rgba(44, 44, 46, 0.35)'],
  accentGradient: ['#C4927A', '#D4A88E', '#E0B89A'],
  sosButton: '#B04A62',
  glassBg: 'rgba(28, 28, 30, 0.82)',

  liquidGlass: 'rgba(255, 255, 255, 0.06)',
  liquidGlassHover: 'rgba(255, 255, 255, 0.1)',
  liquidBorder: 'rgba(255, 255, 255, 0.12)',
};

export type Theme = typeof lightTheme;
