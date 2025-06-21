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
      <BlurOverlay 
        position="top" 
        height={Platform.OS === 'ios' ? 100 : 80} 
        backgroundColor={theme.card} 
      />
      <BlurOverlay 
        position="bottom" 
        height={88} 
        backgroundColor={theme.card} 
      />

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollIndicatorInsets={{ top: 88, bottom: 83 }}
        contentInsetAdjustmentBehavior="automatic"
        bounces={true}
      >
        {/* Time and Date - Clean Top Display */}
        <View style={styles.topTimeContainer}>
          <Text style={[styles.topTimeText, { color: theme.text }]}>
            {formatTime()}
          </Text>
          <Text style={[styles.topDateText, { color: theme.textSecondary }]}>
            {formatDate()}
          </Text>
        </View>

        {/* Floating Welcome Text - No Container */}
        <View style={styles.floatingWelcomeContainer}>
          <Text style={[styles.welcomeText, { color: theme.text }]}>
            Hello, {userName}
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
            {/* Emergency button background */}
            <View style={[styles.emergencyButtonBase, { 
              backgroundColor: theme.contact,
            }]} />
            
            {/* Vibrant glass overlay effect for button pop */}
            <View style={[styles.emergencyButtonOverlay, { 
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
            }]} />
            
            {/* Inner highlight for depth */}
            <View style={[styles.emergencyButtonHighlight, { 
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }]} />
            
            <View style={styles.emergencyButtonContent}>
              <Ionicons name="warning" size={52} color="#fff" />
              <Text style={styles.emergencyButtonText}>
                EMERGENCY
              </Text>
              <Text style={styles.emergencyButtonTextSecondary}>
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
    paddingTop: Platform.OS === 'ios' ? 110 : 90,
    paddingBottom: 120,
  },
  // Time and Date - Clean Top Display
  topTimeContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  topTimeText: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -1,
  },
  topDateText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  // Floating welcome text - no container background
  floatingWelcomeContainer: {
    alignItems: 'center',
    marginHorizontal: 20,
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
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#E67E62',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  emergencyButtonBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 90,
  },
  emergencyButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 90,
  },
  emergencyButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 90,
  },
  emergencyButtonContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 1.5,
  },
  emergencyButtonTextSecondary: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  emergencySubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
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
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 20,
  },
  quickActionsScrollView: {
    flex: 1,
  },
  quickActionsCarousel: {
    paddingHorizontal: 16,
    height: 100,
    alignItems: 'center',
  },
  quickActionItem: {
    marginRight: 16,
    height: 100,
    justifyContent: 'center',
    width: 80,
  },
  quickActionBarItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    height: 100,
    width: 80,
  },
  quickActionBarIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  quickActionBarTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
    width: 64,
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