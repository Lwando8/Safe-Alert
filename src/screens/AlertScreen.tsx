import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Alert,
  Vibration,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlassCard from '../components/GlassCard';
import EmergencyService from '../services/EmergencyService';
import AudioRecordingService from '../services/AudioRecordingService';
import NotificationService from '../services/NotificationService';
import { useHardwareButtons } from '../services/HardwareButtonService';
import { useTheme } from '../context/ThemeContext';

const windowWidth = Dimensions.get('window').width;

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function AlertScreen() {
  const { theme, isDark } = useTheme();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [emergencyService] = useState(() => EmergencyService.getInstance());
  const [audioService] = useState(() => AudioRecordingService.getInstance());
  const [notificationService] = useState(() => NotificationService.getInstance());
  const [isRecording, setIsRecording] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [notificationPermission, setNotificationPermission] = useState(false);

  // Hardware button integration with direct SOS support
  const { simulateEmergency, getHardwareInfo } = useHardwareButtons(
    () => handleMainEmergency(), // Regular callback (with confirmation)
    () => triggerDirectSOS()     // Direct SOS callback (no confirmation)
  );

  useEffect(() => {
    getCurrentLocation();
    loadEmergencyContacts();
    checkNotificationPermission();
    
    // Setup notification response handler
    notificationService.setupNotificationResponseHandler();
  }, []);

  const checkNotificationPermission = () => {
    const hasPermission = notificationService.getNotificationPermissionStatus();
    setNotificationPermission(hasPermission);
  };

  const loadEmergencyContacts = async () => {
    try {
      const savedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (savedContacts) {
        setContacts(JSON.parse(savedContacts));
      }
    } catch (error) {
      console.error('Error loading emergency contacts:', error);
    }
  };

  const sendEmergencyNotifications = async (alertType: string): Promise<number> => {
    try {
      if (!notificationPermission) {
        Alert.alert(
          'Notification Permission Required',
          'Please enable notifications to send emergency alerts to your contacts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Enable', 
              onPress: () => {
                // Re-check permissions
                checkNotificationPermission();
              }
            }
          ]
        );
        return 0;
      }

      const userData = await AsyncStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;
      const userName = user?.fullName || 'Emergency Contact';

      const locationData = location ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      } : undefined;

      const successCount = await notificationService.sendEmergencyNotificationToContacts(
        alertType,
        locationData,
        userName
      );

      return successCount;
    } catch (error) {
      console.error('Error sending emergency notifications:', error);
      return 0;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for emergency services');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation(currentLocation);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Unable to get current location');
    }
  };

  const handleMainEmergency = async () => {
    if (isEmergencyActive) return;

    Alert.alert(
      '🚨 EMERGENCY SOS',
      'This will trigger a critical emergency alert and dispatch police to your location. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CONFIRM SOS',
          style: 'destructive',
          onPress: () => triggerSOSAlert(),
        },
      ]
    );
  };

  const triggerSOSAlert = async () => {
    try {
      setIsEmergencyActive(true);

      // Start emergency audio recording for SOS alerts
      setIsRecording(true);
      const recordingResult = await audioService.startEmergencyRecording('sos');
      if (recordingResult) {
        console.log('Emergency audio recording started for SOS alert');
      }

      if (!location) {
        await getCurrentLocation();
      }

      if (!location) {
        Alert.alert('Error', 'Unable to get location for emergency services');
        setIsEmergencyActive(false);
        setIsRecording(false);
        return;
      }

      // Send SOS alert to police with response tracking
      const emergencyAlert = await emergencyService.sendSOSAlert(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        'Critical Emergency - Police Required'
      );

      // Send emergency notifications to contacts
      const successCount = await sendEmergencyNotifications('Critical SOS Alert');

      // Show confirmation with assigned unit details and notification status
      const notificationStatus = successCount > 0 
        ? `\n🔔 Critical alerts sent to ${successCount} emergency contact(s)`
        : contacts.length > 0 
        ? '\n🔔 Emergency notifications attempted'
        : '\n⚠️ No emergency contacts configured';

      Alert.alert(
        '🚨 SOS ALERT SENT',
        `Emergency alert dispatched!\n\nAssigned Unit: ${emergencyAlert.assignedUnit?.badge}\nOfficer: ${emergencyAlert.assignedUnit?.name}\nETA: ${emergencyAlert.assignedUnit?.eta} minutes\n\n🎙️ Audio recording active for evidence.${notificationStatus}\n\nStay safe and wait for assistance.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setIsEmergencyActive(false);
              setIsRecording(false);
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error sending SOS alert:', error);
      Alert.alert('Error', 'Failed to send SOS alert');
      setIsEmergencyActive(false);
      setIsRecording(false);
    }
  };

  const triggerDirectSOS = async () => {
    try {
      console.log('Direct SOS triggered via hardware buttons - bypassing confirmation');
      
      // Direct SOS without confirmation dialog
      setIsEmergencyActive(true);
      setIsRecording(true);
      
      // Heavy vibration pattern for direct SOS
      Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);

      if (!location) {
        await getCurrentLocation();
      }

      if (location) {
        const emergencyAlert = await emergencyService.sendSOSAlert(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          'DIRECT SOS - Hardware Button Emergency'
        );

        const successCount = await sendEmergencyNotifications('DIRECT SOS - Hardware Activation');

        // Brief success notification for direct SOS
        Alert.alert(
          '🚨 DIRECT SOS SENT',
          `Emergency services notified!\nUnit: ${emergencyAlert.assignedUnit?.badge}\nETA: ${emergencyAlert.assignedUnit?.eta} min`,
          [{ text: 'OK', onPress: () => setIsEmergencyActive(false) }]
        );
      }

    } catch (error) {
      console.error('Error in direct SOS:', error);
      setIsEmergencyActive(false);
    }
  };

  const handleEmergencyType = async (type: 'hospital' | 'security' | 'fire') => {
    if (isEmergencyActive) return;

    const typeLabels = {
      hospital: '🏥 Medical Emergency',
      security: '🛡️ Security Emergency', 
      fire: '🔥 Fire Emergency'
    };

    Alert.alert(
      typeLabels[type],
      `This will send a ${type} emergency alert. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsEmergencyActive(true);
              
              if (!location) {
                await getCurrentLocation();
              }

              const emergencyAlert = await emergencyService.sendSpecializedAlert(
                type,
                location ? {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                } : undefined,
                `${typeLabels[type]} - Immediate Response Required`
              );

              const successCount = await sendEmergencyNotifications(`${typeLabels[type]}`);

              Alert.alert(
                '✅ Emergency Alert Sent',
                `${typeLabels[type]} alert dispatched!\n\nResponse Team: ${emergencyAlert.responseTeam}\nETA: ${emergencyAlert.eta} minutes\n\nNotifications sent to ${successCount} contact(s).`,
                [{ text: 'OK', onPress: () => setIsEmergencyActive(false) }]
              );

            } catch (error) {
              console.error(`Error sending ${type} alert:`, error);
              Alert.alert('Error', `Failed to send ${type} emergency alert`);
              setIsEmergencyActive(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent
      />
      
      {/* Background Gradient */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.background }]}>
        <View style={[StyleSheet.absoluteFillObject, { 
          backgroundColor: isDark 
            ? 'rgba(99, 102, 241, 0.1)' 
            : 'rgba(139, 69, 19, 0.05)' 
        }]} />
      </View>

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <GlassCard style={styles.headerCard} padding={20} borderRadius={24}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Emergency Alert
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {isEmergencyActive ? '🚨 Alert Active' : 'Ready for Emergency'}
            </Text>
          </GlassCard>
        </View>

        {/* Main SOS Button - Circular Design */}
        <View style={styles.mainButtonContainer}>
          <GlassCard style={styles.sosCard}>
            <TouchableOpacity
              style={[
                styles.sosButton,
                {
                  backgroundColor: isEmergencyActive ? theme.emergencyActive : theme.emergency,
                  opacity: isEmergencyActive ? 0.8 : 1,
                }
              ]}
              onPress={handleMainEmergency}
              disabled={isEmergencyActive}
              activeOpacity={0.8}
            >
              {/* Primary button background */}
              <View style={[StyleSheet.absoluteFillObject, { 
                borderRadius: windowWidth * 0.35,
                backgroundColor: isEmergencyActive ? theme.emergencyActive : theme.emergency,
              }]}
            />
              
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
              
              <View style={styles.sosButtonContent}>
                {isEmergencyActive ? (
                  <ActivityIndicator size="large" color="#fff" />
                ) : (
                  <Ionicons name="warning" size={80} color="#fff" />
                )}
                <Text style={styles.sosButtonText}>
                  {isEmergencyActive ? 'ALERT SENT' : 'SOS'}
                </Text>
                <Text style={styles.sosButtonSubtext}>
                  {isEmergencyActive ? 'Emergency services contacted' : 'Hold for 3 seconds'}
                </Text>
              </View>
            </TouchableOpacity>
          </GlassCard>
        </View>

        {/* Emergency Types */}
        <View style={styles.emergencyTypes}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Emergency Types
          </Text>
          
          <View style={styles.typeGrid}>
            <TouchableOpacity
              style={styles.typeButton}
              onPress={() => handleEmergencyType('hospital')}
              disabled={isEmergencyActive}
            >
              <GlassCard style={styles.typeCard}>
                {/* Vibrant icon background to make buttons pop */}
                <View
                  style={[styles.typeIcon, { backgroundColor: theme.hospital }]}
                >
                  <Ionicons name="medical" size={32} color={theme.textOnPrimary} />
                </View>
                <Text style={[styles.typeTitle, { color: theme.text }]}>Medical</Text>
                <Text style={[styles.typeSubtitle, { color: theme.textSecondary }]}>
                  Hospital & Ambulance
                </Text>
              </GlassCard>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.typeButton}
              onPress={() => handleEmergencyType('security')}
              disabled={isEmergencyActive}
            >
              <GlassCard style={styles.typeCard}>
                {/* Vibrant icon background to make buttons pop */}
                <View style={[styles.typeIcon, { 
                  backgroundColor: theme.security,
                  opacity: 0.9,
                }]}>
                  <Ionicons name="shield" size={32} color="#ffffff" />
                </View>
                <Text style={[styles.typeTitle, { color: theme.text }]}>Security</Text>
                <Text style={[styles.typeSubtitle, { color: theme.textSecondary }]}>
                  Police & Safety
                </Text>
              </GlassCard>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.typeButton}
              onPress={() => handleEmergencyType('fire')}
              disabled={isEmergencyActive}
            >
              <GlassCard style={styles.typeCard}>
                {/* Vibrant icon background to make buttons pop */}
                <View style={[styles.typeIcon, { 
                  backgroundColor: theme.monitor,
                  opacity: 0.9,
                }]}>
                  <Ionicons name="flame" size={32} color="#ffffff" />
                </View>
                <Text style={[styles.typeTitle, { color: theme.text }]}>Fire</Text>
                <Text style={[styles.typeSubtitle, { color: theme.textSecondary }]}>
                  Fire Department
                </Text>
              </GlassCard>
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced Status Info */}
        <GlassCard style={styles.statusInfo}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: theme.locationGlass }]}>
              <Ionicons 
                name={location ? "checkmark-circle" : "time"} 
                size={20} 
                color={location ? theme.location : theme.monitor} 
              />
            </View>
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                Location Services
              </Text>
              <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
                {location ? 'Location ready' : 'Getting location...'}
              </Text>
            </View>
          </View>

          <View style={[styles.statusSeparator, { backgroundColor: theme.liquidBorder }]} />

          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: theme.contactGlass }]}>
              <Ionicons 
                name={contacts.length > 0 ? "people" : "person-add"} 
                size={20} 
                color={contacts.length > 0 ? theme.contact : theme.monitor} 
              />
            </View>
            <View style={styles.statusContent}>
              <Text style={[styles.statusTitle, { color: theme.text }]}>
                Emergency Contacts
              </Text>
              <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
                {contacts.length > 0 ? `${contacts.length} contacts ready` : 'No contacts added'}
              </Text>
            </View>
          </View>

          {isRecording && (
            <>
              <View style={[styles.statusSeparator, { backgroundColor: theme.liquidBorder }]} />
              <View style={styles.statusRow}>
                <View style={[styles.statusIcon, { backgroundColor: theme.contactGlass }]}>
                  <Ionicons name="mic" size={20} color={theme.contact} />
                </View>
                <View style={styles.statusContent}>
                  <Text style={[styles.statusTitle, { color: theme.text }]}>
                    Audio Recording
                  </Text>
                  <Text style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
                    Recording emergency audio
                  </Text>
                </View>
              </View>
            </>
          )}
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  headerCard: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  mainButtonContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  sosCard: {
    alignItems: 'center',
  },
  sosButton: {
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
  sosButtonContent: {
    alignItems: 'center',
    zIndex: 1,
  },
  sosButtonText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 2,
  },
  sosButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  emergencyTypes: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  typeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  typeButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  typeCard: {
    alignItems: 'center',
    minHeight: 140,
  },
  typeIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  typeSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  statusInfo: {},
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: 14,
  },
  statusSeparator: {
    height: 1,
    marginVertical: 16,
    marginLeft: 56,
  },
}); 