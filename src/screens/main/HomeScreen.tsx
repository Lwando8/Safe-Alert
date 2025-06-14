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
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import { useTheme } from '../../context/ThemeContext';

const windowWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const [userName, setUserName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
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
      }
    } catch (error) {
      console.error('Error getting location:', error);
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
        color: '#2ecc71',
        text: 'LOCATION ACTIVE'
      };
    }
    return {
      icon: 'location-outline' as const,
      color: '#f39c12',
      text: 'GETTING LOCATION'
    };
  };

  const locationStatus = getLocationStatus();

  return (
    <Screen>
      <ScrollView style={createStyles(theme).container} showsVerticalScrollIndicator={false}>
        {/* Welcome Header */}
        <View style={createStyles(theme).welcomeContainer}>
          <View style={createStyles(theme).timeContainer}>
            <Text style={createStyles(theme).timeText}>{formatTime()}</Text>
            <Text style={createStyles(theme).dateText}>{formatDate()}</Text>
          </View>
          <Text style={createStyles(theme).greetingText}>
            {getGreeting()}, {userName || 'User'}!
          </Text>
        </View>

        {/* Status Card */}
        <View style={createStyles(theme).statusCard}>
          <TouchableOpacity 
            style={createStyles(theme).emergencyButton}
            onPress={handleEmergencyAlert}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark" size={48} color="#fff" />
            <Text style={createStyles(theme).emergencyButtonText}>SAFE ALERT</Text>
            <Text style={createStyles(theme).emergencyButtonSubtext}>TAP FOR EMERGENCY</Text>
          </TouchableOpacity>
          
          {/* Location Status */}
          <View style={createStyles(theme).locationStatusContainer}>
            <Ionicons name={locationStatus.icon} size={16} color={locationStatus.color} />
            <Text style={[createStyles(theme).locationStatusText, { color: locationStatus.color }]}>
              {locationStatus.text}
            </Text>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={createStyles(theme).section}>
          <Text style={createStyles(theme).sectionTitle}>Quick Actions</Text>
          
          <View style={createStyles(theme).actionsGrid}>
            <TouchableOpacity 
              style={createStyles(theme).actionButton}
              onPress={handleShareLocation}
              disabled={isLocationLoading}
            >
              <View style={[createStyles(theme).actionCircle, { backgroundColor: '#3498db' }]}>
                <Ionicons 
                  name={isLocationLoading ? "sync" : "location"} 
                  size={28} 
                  color="#ffffff" 
                />
              </View>
              <Text style={createStyles(theme).actionButtonText}>
                {isLocationLoading ? 'Sharing...' : 'Share Location'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={createStyles(theme).actionButton}
              onPress={handleEmergencyContacts}
            >
              <View style={[createStyles(theme).actionCircle, { backgroundColor: '#e74c3c' }]}>
                <Ionicons name="people" size={28} color="#ffffff" />
              </View>
              <Text style={createStyles(theme).actionButtonText}>Emergency Contacts</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={createStyles(theme).actionButton}
              onPress={handleSettings}
            >
              <View style={[createStyles(theme).actionCircle, { backgroundColor: '#9b59b6' }]}>
                <Ionicons name="person-circle" size={28} color="#ffffff" />
              </View>
              <Text style={createStyles(theme).actionButtonText}>Profile & Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={createStyles(theme).actionButton}
              onPress={() => navigation.navigate('Alert' as never)}
            >
              <View style={[createStyles(theme).actionCircle, { backgroundColor: '#f39c12' }]}>
                <Ionicons name="pulse" size={28} color="#ffffff" />
              </View>
              <Text style={createStyles(theme).actionButtonText}>Emergency Monitor</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safety Tips Section */}
        <View style={createStyles(theme).section}>
          <Text style={createStyles(theme).sectionTitle}>Safety Tips</Text>
          <View style={createStyles(theme).tipsContainer}>
            <View style={createStyles(theme).tipItem}>
              <Ionicons name="information-circle" size={16} color="#3498db" />
              <Text style={createStyles(theme).tipText}>Keep emergency contacts updated</Text>
            </View>
            <View style={createStyles(theme).tipItem}>
              <Ionicons name="location" size={16} color="#3498db" />
              <Text style={createStyles(theme).tipText}>Always keep location services enabled</Text>
            </View>
            <View style={createStyles(theme).tipItem}>
              <Ionicons name="battery-charging" size={16} color="#3498db" />
              <Text style={createStyles(theme).tipText}>Maintain phone battery above 20%</Text>
            </View>
          </View>
        </View>

        {/* Emergency Info */}
        <View style={createStyles(theme).emergencyInfo}>
          <Text style={createStyles(theme).emergencyInfoTitle}>⚠️ Emergency Information</Text>
          <Text style={createStyles(theme).emergencyInfoText}>
            In case of emergency, use the SOS button above or press Power + Volume Down buttons together to trigger emergency alerts.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  welcomeContainer: {
    backgroundColor: theme.card,
    padding: 24,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timeText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.text,
  },
  dateText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 4,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emergencyButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  emergencyButtonText: {
    color: theme.textOnPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emergencyButtonSubtext: {
    color: theme.textOnPrimary,
    fontSize: 12,
    marginTop: 4,
    opacity: 0.9,
  },
  locationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  locationStatusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: theme.text,
  },
  section: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: theme.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  actionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
    marginTop: 8,
    textAlign: 'center',
  },
  tipsContainer: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 8,
  },
  tipText: {
    fontSize: 14,
    color: theme.text,
    marginLeft: 12,
    flex: 1,
  },
  emergencyInfo: {
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.monitor,
  },
  emergencyInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.monitor,
    marginBottom: 8,
  },
  emergencyInfoText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  quickActionContainer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    marginHorizontal: 8,
    paddingVertical: 18,
    paddingHorizontal: 0,
    minWidth: 120,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#222',
  },
}); 