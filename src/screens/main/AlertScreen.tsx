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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Screen from '../../components/Screen';
import EmergencyService from '../../services/EmergencyService';
import AudioRecordingService from '../../services/AudioRecordingService';
import NotificationService from '../../services/NotificationService';
import { useHardwareButtons } from '../../services/HardwareButtonService';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function AlertScreen() {
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

  const testNotificationSystem = async () => {
    try {
      await notificationService.testEmergencyNotification();
      Alert.alert(
        'Test Notification Sent',
        'Check your notifications to see if the emergency alert system is working correctly.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error testing notifications:', error);
      Alert.alert('Error', 'Failed to send test notification');
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

              // Show confirmation with assigned unit details and notification status
        const notificationStatus = successCount > 0 
          ? `\n🔔 Critical alerts sent to ${successCount} emergency contact(s)`
          : contacts.length > 0 
          ? '\n🔔 Emergency notifications attempted'
          : '\n⚠️ No emergency contacts configured';

        Alert.alert(
          '🚨 SOS ALERT SENT',
          `Emergency alert dispatched!\n\nAssigned Unit: ${emergencyAlert.assignedUnit?.badge}\nOfficer: ${emergencyAlert.assignedUnit?.name}\nETA: ${emergencyAlert.assignedUnit?.eta} minutes\n\n🎙️ Audio recording active for evidence.${notificationStatus}\n\nStay safe and wait for assistance.`,
          [{ text: 'OK' }]
        );

              // Send critical push notifications to emergency contacts
        const successCount = await sendEmergencyNotifications('SOS Police Alert');
        console.log(`${successCount} emergency notifications sent successfully`);

    } catch (error) {
      console.error('Error triggering SOS alert:', error);
      Alert.alert('Error', 'Failed to send SOS alert. Please try again or call emergency services directly.');
    } finally {
      setIsEmergencyActive(false);
    }
  };

  const handleEmergencyType = async (type: 'hospital' | 'security' | 'fire') => {
    try {
      if (!location) {
        await getCurrentLocation();
      }

      if (!location) {
        Alert.alert('Error', 'Unable to get location for emergency services');
        return;
      }

      const emergencyTypes = {
        hospital: 'Medical Emergency',
        security: 'Security Emergency', 
        fire: 'Fire Emergency',
      };

      Alert.alert(
        `${emergencyTypes[type]}`,
        'Send critical alert to emergency contacts?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send Alert',
            style: 'destructive',
            onPress: async () => {
              // Start audio recording for security alerts
              if (type === 'security') {
                setIsRecording(true);
                const recordingResult = await audioService.startEmergencyRecording('security');
                if (recordingResult) {
                  console.log('Emergency audio recording started for security alert');
                }
              }

              // Send critical push notifications to emergency contacts
              const successCount = await sendEmergencyNotifications(emergencyTypes[type]);

              // Also send through emergency service for logging
              await emergencyService.sendEmergencyContactAlert(
                [],
                emergencyTypes[type],
                {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }
              );

              const notificationMessage = successCount > 0 
                ? `${emergencyTypes[type]} critical alerts sent to ${successCount} contact(s)${type === 'security' ? '\n\n🎙️ Audio recording active for evidence.' : ''}`
                : `${emergencyTypes[type]} alert sent to your emergency contacts${type === 'security' ? '\n\n🎙️ Audio recording active for evidence.' : ''}`;

              Alert.alert('Alert Sent', notificationMessage);
            },
          },
        ]
      );
    } catch (error) {
      console.error(`Error handling ${type} emergency:`, error);
      Alert.alert('Error', 'Failed to send emergency alert');
    }
  };

  const showHardwareInfo = () => {
    const info = getHardwareInfo();
    Alert.alert(
      'Emergency Hardware Shortcut',
      info,
      [{ text: 'OK' }]
    );
  };

  const triggerDirectSOS = async () => {
    // Direct SOS without confirmation dialog (triggered by hardware buttons)
    try {
      console.log('DIRECT SOS TRIGGERED - Hardware Button Emergency');
      Vibration.vibrate([0, 1000, 500, 1000]); // Strong vibration pattern
      await triggerSOSAlert();
    } catch (error) {
      console.error('Error in direct SOS:', error);
      Alert.alert('Emergency Error', 'Failed to trigger direct SOS. Please use the main SOS button.');
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Emergency Header */}
        <View style={styles.header}>
          <Ionicons name="warning" size={32} color="#e74c3c" />
          <Text style={styles.title}>Emergency Alert</Text>
          <Text style={styles.subtitle}>Press for immediate assistance</Text>
        </View>

        {/* Hardware Button Info */}
        <TouchableOpacity style={styles.hardwareButtonInfo} onPress={showHardwareInfo}>
          <Ionicons name="hardware-chip" size={20} color="#7f8c8d" />
          <View style={styles.hardwareButtonTextContainer}>
            <Text style={styles.hardwareButtonText}>
              Emergency Shortcut: Power + Volume Down
            </Text>
            <Text style={styles.hardwareButtonSubtext}>
              Tap for more information
            </Text>
          </View>
          <Ionicons name="information-circle" size={16} color="#3498db" />
        </TouchableOpacity>

        {/* Main Emergency Button */}
        <View style={styles.emergencyButtonContainer}>
          <TouchableOpacity
            style={[
              styles.emergencyButton,
              isEmergencyActive && styles.emergencyButtonActive
            ]}
            onPress={handleMainEmergency}
            disabled={isEmergencyActive}
          >
            {isEmergencyActive ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                <Ionicons name="warning" size={60} color="#fff" />
                <Text style={styles.emergencyButtonText}>SOS</Text>
                <Text style={styles.emergencyButtonSubtext}>Police Dispatch</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Location Status */}
        <View style={styles.locationStatus}>
          <Ionicons 
            name={location ? "location" : "location-outline"} 
            size={16} 
            color={location ? "#2ecc71" : "#e74c3c"} 
          />
          <Text style={styles.locationText}>
            {location ? 'Location: Ready' : 'Location: Getting position...'}
          </Text>
        </View>

        {/* Recording Status */}
        {isRecording && (
          <View style={styles.recordingStatus}>
            <Ionicons name="mic" size={16} color="#e74c3c" />
            <Text style={styles.recordingText}>🎙️ Audio Recording Active</Text>
            <View style={styles.recordingIndicator} />
          </View>
        )}

        {/* Emergency Types */}
        <View style={styles.emergencyTypesContainer}>
          <Text style={styles.emergencyTypesTitle}>Other Emergency Services</Text>
          <View style={styles.emergencyTypes}>
            <TouchableOpacity
              style={styles.emergencyTypeButton}
              onPress={() => handleEmergencyType('hospital')}
            >
              <Ionicons name="medical" size={24} color="#2ecc71" />
              <Text style={styles.emergencyTypeText}>Hospital</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emergencyTypeButton}
              onPress={() => handleEmergencyType('security')}
            >
              <Ionicons name="shield" size={24} color="#9b59b6" />
              <Text style={styles.emergencyTypeText}>Security</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emergencyTypeButton}
              onPress={() => handleEmergencyType('fire')}
            >
              <Ionicons name="flame" size={24} color="#f39c12" />
              <Text style={styles.emergencyTypeText}>Fire</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Test Buttons */}
        <View style={styles.testButtonsContainer}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={simulateEmergency}
          >
            <Ionicons name="hardware-chip" size={16} color="#fff" />
            <Text style={styles.testButtonText}>Test Hardware</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.testButton, styles.testNotificationButton]}
            onPress={testNotificationSystem}
          >
            <Ionicons name="notifications" size={16} color="#fff" />
            <Text style={styles.testButtonText}>Test Notifications</Text>
          </TouchableOpacity>
        </View>

        {/* Active Alerts Display */}
        <View style={styles.activeAlerts}>
          <Text style={styles.activeAlertsTitle}>Active Emergency Alerts</Text>
          {emergencyService.getActiveAlerts().length > 0 ? (
            emergencyService.getActiveAlerts().map((alert) => (
              <View key={alert.id} style={styles.alertItem}>
                <Ionicons name="radio-button-on" size={12} color="#e74c3c" />
                <Text style={styles.alertText}>
                  {alert.type.toUpperCase()} - {alert.status}
                  {alert.assignedUnit && ` (${alert.assignedUnit.badge})`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noAlertsText}>No active alerts</Text>
          )}
        </View>

        {/* Emergency Contacts Status */}
        <View style={styles.contactsStatus}>
          <Text style={styles.contactsStatusTitle}>🔔 Emergency Notifications</Text>
          <Text style={styles.contactsStatusText}>
            {contacts.length > 0 && notificationPermission
              ? `${contacts.length} contact(s) configured - Critical push notifications enabled`
              : contacts.length > 0 && !notificationPermission
              ? `${contacts.length} contact(s) configured - Enable notifications for alerts`
              : 'No emergency contacts configured - Add contacts in My Community tab'
            }
          </Text>
          {contacts.length > 0 && !notificationPermission && (
            <TouchableOpacity 
              style={styles.enableNotificationsButton}
              onPress={checkNotificationPermission}
            >
              <Ionicons name="notifications" size={16} color="#fff" />
              <Text style={styles.enableNotificationsText}>Enable Notifications</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Emergency Information */}
        <View style={styles.emergencyInfo}>
          <Text style={styles.emergencyInfoTitle}>⚠️ Emergency Information</Text>
          <Text style={styles.emergencyInfoText}>
            • SOS button dispatches nearest police unit with GPS tracking{'\n'}
            • Critical push notifications sent instantly to all emergency contacts{'\n'}
            • Notifications bypass Do Not Disturb and silent mode{'\n'}
            • Power + Volume Down buttons trigger direct emergency SOS{'\n'}
            • Audio recording starts automatically for SOS and Security alerts{'\n'}
            • Response times are tracked for police monitoring{'\n'}
            • Your medical information and location shared with first responders
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 5,
  },
  header: {
    alignItems: 'center',
    marginTop: -5,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 5,
  },
  hardwareButtonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  hardwareButtonTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  hardwareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
  },
  hardwareButtonSubtext: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  emergencyButtonContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emergencyButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#e74c3c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  emergencyButtonActive: {
    backgroundColor: '#c0392b',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emergencyButtonSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  locationText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 8,
  },
  recordingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  recordingText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 8,
  },
  recordingIndicator: {
    width: 100,
    height: 4,
    backgroundColor: '#e74c3c',
    borderRadius: 2,
    marginLeft: 8,
  },
  emergencyTypesContainer: {
    marginBottom: 24,
  },
  emergencyTypesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 16,
  },
  emergencyTypes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  emergencyTypeButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 100,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  emergencyTypeText: {
    color: '#2c3e50',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  testButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  testButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
  },
  testNotificationButton: {
    backgroundColor: '#9b59b6',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  enableNotificationsButton: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  enableNotificationsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeAlerts: {
    backgroundColor: '#fff3e0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  activeAlertsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f39c12',
    marginBottom: 8,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 8,
  },
  noAlertsText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  contactsStatus: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  contactsStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  contactsStatusText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  emergencyInfo: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  emergencyInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emergencyInfoText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
}); 