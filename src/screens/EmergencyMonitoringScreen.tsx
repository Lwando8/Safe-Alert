import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Vibration,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import * as Location from 'expo-location';
import {
  sendSosAlertWithFeedback,
  sendTypedAlertWithFeedback,
  stopLocationStreaming,
} from '../services/EmergencyDispatchService';

export default function EmergencyMonitoringScreen() {
  const { theme } = useTheme();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    return () => {
      stopLocationStreaming();
    };
  }, []);

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

  const handleSOSPress = () => {
    Vibration.vibrate([0, 500, 200, 500]);

    Alert.alert(
      'EMERGENCY SOS',
      'This will immediately send an emergency alert to dispatch with your location. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'SEND SOS',
          style: 'destructive',
          onPress: () => triggerEmergencyAlert(),
        },
      ]
    );
  };

  const handleHospitalAlert = () => {
    Vibration.vibrate(200);
    
    Alert.alert(
      'MEDICAL EMERGENCY',
      'This will send a medical emergency alert and request ambulance services. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'SEND ALERT', 
          style: 'destructive',
          onPress: () => triggerMedicalAlert()
        }
      ]
    );
  };

  const handleArmedResponseAlert = () => {
    Vibration.vibrate(200);
    
    Alert.alert(
      'SECURITY EMERGENCY',
      'This will send a security alert and request armed response. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'SEND ALERT', 
          style: 'destructive',
          onPress: () => triggerSecurityAlert()
        }
      ]
    );
  };

  const triggerEmergencyAlert = async () => {
    setIsSending(true);
    const result = await sendSosAlertWithFeedback(location);
    if (result) {
      setActiveAlertId(result.id);
      setIsEmergencyActive(true);
    }
    setIsSending(false);
  };

  const triggerMedicalAlert = async () => {
    setIsEmergencyActive(true);
    setIsSending(true);
    const result = await sendTypedAlertWithFeedback('medical', location);
    if (result) setActiveAlertId(result.id);
    setIsSending(false);
  };

  const triggerSecurityAlert = async () => {
    setIsEmergencyActive(true);
    setIsSending(true);
    const result = await sendTypedAlertWithFeedback('security', location);
    if (result) setActiveAlertId(result.id);
    setIsSending(false);
  };

  const cancelEmergency = () => {
    setIsEmergencyActive(false);
    setActiveAlertId(null);
    stopLocationStreaming();
    Vibration.cancel();
  };

  return (
    <Screen>
      <ScrollView style={createStyles(theme).container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={createStyles(theme).header}>
          <Ionicons name="shield-checkmark" size={32} color={theme.primary} />
          <Text style={createStyles(theme).headerTitle}>Emergency Alert</Text>
          <Text style={createStyles(theme).headerSubtitle}>
            {location ? 'Location Active' : 'Getting Location...'}
          </Text>
        </View>

        {/* Emergency Status */}
        {isEmergencyActive && (
          <View style={createStyles(theme).emergencyStatus}>
            <Text style={createStyles(theme).emergencyStatusTitle}>
              🚨 EMERGENCY ALERT ACTIVE
            </Text>
            <Text style={createStyles(theme).countdownText}>
              {isSending ? 'Sending alert…' : 'Alert sent! Help is on the way.'}
            </Text>
            <TouchableOpacity
              style={createStyles(theme).cancelButton}
              onPress={cancelEmergency}
            >
              <Text style={createStyles(theme).cancelButtonText}>CLEAR STATUS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main SOS Button */}
        <View style={createStyles(theme).mainAlertContainer}>
          <TouchableOpacity 
            style={[
              createStyles(theme).sosButton,
              isEmergencyActive && createStyles(theme).sosButtonActive
            ]}
            onPress={handleSOSPress}
            activeOpacity={0.8}
            disabled={isSending}
          >
            <Ionicons name="warning" size={64} color={theme.textOnPrimary} />
            <Text style={createStyles(theme).sosButtonText}>SOS</Text>
            <Text style={createStyles(theme).sosButtonSubtext}>
              EMERGENCY ALERT
            </Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Alert Buttons */}
        <View style={createStyles(theme).secondaryAlertsContainer}>
          <Text style={createStyles(theme).sectionTitle}>Quick Emergency Alerts</Text>
          
          <View style={createStyles(theme).alertButtonsRow}>
            {/* Hospital Alert */}
            <TouchableOpacity 
              style={createStyles(theme).secondaryAlertButton}
              onPress={handleHospitalAlert}
              activeOpacity={0.8}
            >
              <View
                style={[createStyles(theme).alertCircle, { backgroundColor: theme.hospital }]}
              >
                <Ionicons name="medical" size={32} color={theme.textOnPrimary} />
              </View>
              <Text style={createStyles(theme).alertButtonTitle}>Hospital</Text>
              <Text style={createStyles(theme).alertButtonSubtitle}>Medical Emergency</Text>
            </TouchableOpacity>

            {/* Armed Response Alert */}
            <TouchableOpacity 
              style={createStyles(theme).secondaryAlertButton}
              onPress={handleArmedResponseAlert}
              activeOpacity={0.8}
            >
              <View
                style={[createStyles(theme).alertCircle, { backgroundColor: theme.security }]}
              >
                <Ionicons name="shield" size={32} color={theme.textOnPrimary} />
              </View>
              <Text style={createStyles(theme).alertButtonTitle}>Armed Response</Text>
              <Text style={createStyles(theme).alertButtonSubtitle}>Security Emergency</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safety Instructions */}
        <View style={createStyles(theme).instructionsContainer}>
          <Text style={createStyles(theme).instructionsTitle}>Emergency Instructions</Text>
          
          <View style={createStyles(theme).instructionItem}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <Text style={createStyles(theme).instructionText}>
              SOS Button: Sends alert to all emergency contacts and services
            </Text>
          </View>
          
          <View style={createStyles(theme).instructionItem}>
            <Ionicons name="medical" size={20} color="#e74c3c" />
            <Text style={createStyles(theme).instructionText}>
              Hospital: Specifically requests medical/ambulance services
            </Text>
          </View>
          
          <View style={createStyles(theme).instructionItem}>
            <Ionicons name="shield" size={20} color="#3498db" />
            <Text style={createStyles(theme).instructionText}>
              Armed Response: Requests security/police assistance
            </Text>
          </View>
        </View>

        {/* Location Status */}
        <View style={createStyles(theme).locationContainer}>
          <View style={createStyles(theme).locationHeader}>
            <Ionicons 
              name={location ? "location" : "location-outline"} 
              size={20} 
              color={location ? "#2ecc71" : "#f39c12"} 
            />
            <Text style={createStyles(theme).locationTitle}>
              {location ? "Location Ready" : "Getting Location..."}
            </Text>
          </View>
          
          {location && (
            <Text style={createStyles(theme).locationText}>
              Your location will be shared with emergency responders
            </Text>
          )}
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
  header: {
    backgroundColor: theme.card,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 4,
  },
  emergencyStatus: {
    backgroundColor: '#e74c3c',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  emergencyStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mainAlertContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.emergency,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: theme.emergency,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sosButtonActive: {
    backgroundColor: theme.emergencyActive,
  },
  sosButtonText: {
    color: theme.textOnPrimary,
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
  },
  sosButtonSubtext: {
    color: theme.textOnPrimary,
    fontSize: 14,
    marginTop: 4,
    opacity: 0.9,
  },
  secondaryAlertsContainer: {
    marginHorizontal: 16,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  alertButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  secondaryAlertButton: {
    alignItems: 'center',
    width: '45%',
  },
  alertCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  alertButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  alertButtonSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  instructionsContainer: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
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
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: theme.text,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  locationContainer: {
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    marginLeft: 8,
  },
  locationText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 18,
  },
}); 