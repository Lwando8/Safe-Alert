import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Share,
  Vibration,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import GlassCard from '../../components/GlassCard';
import BlurOverlay from '../../components/BlurOverlay';
import { useTheme } from '../../context/ThemeContext';

const windowWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const [userName, setUserName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationText, setLocationText] = useState<string>('Getting location...');
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.fullName || 'User');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
        
        // Get readable location
        try {
          const [address] = await Location.reverseGeocodeAsync({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
          
          if (address) {
            setLocationText(`${address.city || 'Unknown'}, ${address.region || 'Unknown'}`);
          } else {
            setLocationText(`${currentLocation.coords.latitude.toFixed(4)}, ${currentLocation.coords.longitude.toFixed(4)}`);
          }
        } catch (geocodeError) {
          setLocationText('Location available');
        }
      } else {
        setLocationText('Location permission denied');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationText('Location unavailable');
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatTime = () => {
    return currentTime.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleShareLocation = async () => {
    try {
      setIsLocationLoading(true);
      
      if (!location) {
        await requestLocationPermission();
      }

      if (location) {
        const locationUrl = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
        const message = `I'm sharing my current location with you: ${locationUrl}`;
        
        await Share.share({
          message: message,
          title: 'My Current Location',
        });
      } else {
        Alert.alert(
          'Location Unavailable',
          'Unable to get your current location. Please check your location settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Error', 'Failed to share location');
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handleEmergencyAlert = () => {
    Alert.alert(
      'Quick Emergency Alert',
      'This will take you to the emergency alert screen. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue', 
          onPress: () => {
            Vibration.vibrate(200);
            navigation.navigate('Alert' as never);
          }
        }
      ]
    );
  };

  const handleEmergencyContacts = () => {
    navigation.navigate('Contacts' as never);
  };

  const handleSettings = () => {
    navigation.navigate('Profile' as never);
  };

  const getLocationStatus = () => {
    if (location) {
      return {
        icon: 'location' as const,
        color: theme.location,
        text: 'LOCATION ACTIVE'
      };
    }
    return {
      icon: 'location-outline' as const,
      color: theme.monitor,
      text: 'GETTING LOCATION'
    };
  };

  const locationStatus = getLocationStatus();

  return (
    <Screen>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent
      />
      
      {/* Background Gradient */}
      <View style={[styles.gradientBackground, { 
        backgroundColor: theme.background 
      }]}>
        <View style={[styles.gradientOverlay, { 
          backgroundColor: isDark 
            ? 'rgba(99, 102, 241, 0.1)' 
            : 'rgba(139, 69, 19, 0.05)' 
        }]} />
      </View>

      {/* Blur Overlays for Toolbars */}
      <View style={{ zIndex: 500 }}>
        <BlurOverlay 
          position="top" 
          height={Platform.OS === 'ios' ? 130 : 110} 
          backgroundColor={theme.card} 
        />
      </View>
      <View style={{ zIndex: 500 }}>
        <BlurOverlay 
          position="bottom" 
          height={88} 
          backgroundColor={theme.card} 
        />
      </View>

      {/* Fixed Top Bar with Home Title and Time/Date */}
      <View style={[styles.fixedTopBar, { 
        backgroundColor: 'transparent',
        zIndex: 1000, // Bring to front
      }]}>
        <View style={styles.topBarContent}>
          <Text style={[styles.homeTitle, { color: theme.text }]}>
            Home
          </Text>
          <View style={styles.timeDisplayContainer}>
            <Text style={[styles.topBarTimeText, { color: theme.text }]}>
              {formatTime()}
            </Text>
            <Text style={[styles.topBarDateText, { color: theme.textSecondary }]}>
              {formatDate()}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollIndicatorInsets={{ top: 120, bottom: 83 }}
        contentInsetAdjustmentBehavior="automatic"
        bounces={true}
      >

        {/* Welcome Content - starts after fixed top bar */}
        <View style={styles.welcomeContainer}>
          <Text style={[styles.welcomeText, { color: theme.text }]}>
            Hello,
          </Text>
          <Text style={[styles.subtitleText, { color: theme.textSecondary }]}>
            Your safety is our priority. Stay protected.
          </Text>
          
          {/* Status indicator */}
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, { backgroundColor: theme.location }]} />
            <Text style={[styles.statusIndicatorText, { color: theme.textSecondary }]}>
              All systems operational
            </Text>
          </View>
        </View>

        {/* Emergency Button - Central and Moved Up */}
        <View style={styles.emergencyButtonContainer}>
          <TouchableOpacity 
            style={[styles.emergencyButton, { 
              backgroundColor: theme.contact,
              shadowColor: theme.contact,
            }]}
            onPress={handleEmergencyAlert}
            activeOpacity={0.8}
          >
            {/* Primary button background */}
            <View style={[StyleSheet.absoluteFillObject, { 
              borderRadius: windowWidth * 0.35,
              backgroundColor: theme.contact
            }]} />
            
            {/* Vibrant glass overlay effect for button pop */}
            <View style={[StyleSheet.absoluteFillObject, { 
              borderRadius: windowWidth * 0.35,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
            }]} />
            
            {/* Inner highlight for depth */}
            <View style={[StyleSheet.absoluteFillObject, { 
              borderRadius: windowWidth * 0.35,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              transform: [{ translateY: -2 }],
            }]} />
            
            <View style={styles.emergencyButtonContent}>
              <Ionicons name="warning" size={80} color="#fff" />
              <Text style={styles.emergencyButtonText}>
                SOS
              </Text>
              <Text style={styles.emergencySubtext}>
                Tap to activate
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Location Info - Compact */}
        <View style={styles.infoContainer}>
          <View style={styles.locationContainer}>
            <View style={[styles.locationDot, { backgroundColor: theme.location }]} />
            <Ionicons 
              name="location" 
              size={16} 
              color={theme.textSecondary} 
            />
            <Text style={[styles.locationText, { color: theme.textSecondary }]}>
              {locationText}
            </Text>
          </View>
        </View>

        {/* Quick Actions Carousel */}
        <View style={styles.quickActionsContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Quick Actions
          </Text>
          <View style={[styles.quickActionsSolidBar, { backgroundColor: theme.surface }]}>
            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsCarousel}
              style={styles.quickActionsScrollView}
            >
              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={handleShareLocation}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionBarItem}>
                  <View style={[styles.quickActionBarIconContainer, { 
                    backgroundColor: theme.location 
                  }]}>
                    <Ionicons 
                      name="location" 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={[styles.quickActionBarTitle, { color: theme.text }]}>
                    Location
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={handleEmergencyContacts}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionBarItem}>
                  <View style={[styles.quickActionBarIconContainer, { 
                    backgroundColor: theme.skyBlue 
                  }]}>
                    <Ionicons 
                      name="people" 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={[styles.quickActionBarTitle, { color: theme.text }]}>
                    Contacts
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => navigation.navigate('SafeZones' as never)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionBarItem}>
                  <View style={[styles.quickActionBarIconContainer, { 
                    backgroundColor: theme.security 
                  }]}>
                    <Ionicons 
                      name="shield" 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={[styles.quickActionBarTitle, { color: theme.text }]}>
                    Zones
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={handleSettings}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionBarItem}>
                  <View style={[styles.quickActionBarIconContainer, { 
                    backgroundColor: theme.profile 
                  }]}>
                    <Ionicons 
                      name="settings" 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={[styles.quickActionBarTitle, { color: theme.text }]}>
                    Settings
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => navigation.navigate('MedicalInfo' as never)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionBarItem}>
                  <View style={[styles.quickActionBarIconContainer, { 
                    backgroundColor: theme.primary 
                  }]}>
                    <Ionicons 
                      name="medical" 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={[styles.quickActionBarTitle, { color: theme.text }]}>
                    Medical
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickActionItem}
                onPress={() => navigation.navigate('EmergencyMonitoring' as never)}
                activeOpacity={0.7}
              >
                <View style={styles.quickActionBarItem}>
                  <View style={[styles.quickActionBarIconContainer, { 
                    backgroundColor: theme.monitor 
                  }]}>
                    <Ionicons 
                      name="pulse" 
                      size={20} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={[styles.quickActionBarTitle, { color: theme.text }]}>
                    Monitoring
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>

        {/* Recent Activity */}
        <GlassCard style={styles.activityCard}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Recent Activity
          </Text>
          <View style={styles.activityItem}>
            <View style={[styles.activityIcon, { 
              backgroundColor: theme.liquidGlass 
            }]}>
              <Ionicons 
                name="checkmark-circle" 
                size={20} 
                color={theme.location} 
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityMessage, { color: theme.text }]}>
                Location permissions granted
              </Text>
              <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
                Just now
              </Text>
            </View>
          </View>
          
          <View style={[styles.activitySeparator, { backgroundColor: theme.border }]} />
          
          <View style={styles.activityItem}>
            <View style={[styles.activityIcon, { 
              backgroundColor: theme.liquidGlass 
            }]}>
              <Ionicons 
                name="shield-checkmark" 
                size={20} 
                color={theme.security} 
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.activityMessage, { color: theme.text }]}>
                Safety features enabled
              </Text>
              <Text style={[styles.activityTime, { color: theme.textSecondary }]}>
                Today
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Unified Status Container */}
        <GlassCard style={styles.unifiedStatusCard}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            System Status
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.statusIconContainer, { 
                backgroundColor: theme.locationGlass 
              }]}>
                <Ionicons name="shield-checkmark" size={24} color={theme.location} />
              </View>
              <Text style={[styles.statusText, { color: theme.text }]}>
                Protected
              </Text>
              <Text style={[styles.statusSubtext, { color: theme.textSecondary }]}>
                All systems active
              </Text>
            </View>
            
            <View style={styles.statusItem}>
              <View style={[styles.statusIconContainer, { 
                backgroundColor: theme.contactGlass 
              }]}>
                <Ionicons 
                  name="people" 
                  size={24} 
                  color={theme.contact} 
                />
              </View>
              <Text style={[styles.statusText, { color: theme.text }]}>
                3 Contacts
              </Text>
              <Text style={[styles.statusSubtext, { color: theme.textSecondary }]}>
                Ready to alert
              </Text>
            </View>
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 160 : 140, // Increased for larger fixed top bar
    paddingBottom: 120,
  },
  // Fixed Top Bar Styles
  fixedTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20, // Below status bar
    left: 0,
    right: 0,
    zIndex: 1000, // Higher z-index to stay on top
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 1000, // Android elevation
  },
  topBarContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  timeDisplayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTimeText: {
    fontSize: 28, // Larger for better visibility
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  topBarDateText: {
    fontSize: 16, // Slightly larger
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  // Welcome Container
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },


  welcomeText: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusIndicatorText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Emergency button - moved up and made more central
  emergencyButtonContainer: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 40,
  },
  emergencyButton: {
    width: windowWidth * 0.7,
    height: windowWidth * 0.7,
    borderRadius: windowWidth * 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#E67E62',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },

  emergencyButtonContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 2,
  },
  emergencySubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  // Compact info section
  infoContainer: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 32,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  locationText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 4,
  },
  quickActionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.5,
    marginHorizontal: 20,
  },
  quickActionsSolidBar: {
    height: 110, // Slightly taller like Control Center
    borderRadius: 16, // Larger border radius
    overflow: 'hidden',
    marginHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // Strong glass effect
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  quickActionsScrollView: {
    flex: 1,
  },
  quickActionsCarousel: {
    paddingHorizontal: 16,
    height: 110, // Match the bar height
    alignItems: 'center',
  },
  quickActionItem: {
    marginRight: 20, // More spacing like Control Center
    height: 110,
    justifyContent: 'center',
    width: 85, // Slightly wider
  },
  quickActionBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 110,
    width: 85,
  },
  quickActionBarIconContainer: {
    width: 48, // Larger icons like Control Center
    height: 48,
    borderRadius: 14, // Larger border radius like Control Center
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  quickActionBarTitle: {
    fontSize: 13, // Slightly larger text
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
    width: 75,
  },
  activityCard: {
    marginHorizontal: 20,
    marginBottom: 32,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 14,
  },
  activitySeparator: {
    height: 1,
    marginVertical: 16,
    marginLeft: 56,
  },
  unifiedStatusCard: {
    marginHorizontal: 20,
    marginBottom: 32,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
}); 