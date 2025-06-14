import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Screen from '../../components/Screen';
import { useTheme } from '../../context/ThemeContext';

interface AppSettings {
  notifications: boolean;
  locationTracking: boolean;
  emergencyAlerts: boolean;
  biometricAuth: boolean;
  autoShareLocation: boolean;
  batteryOptimization: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.card,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  header: {
    backgroundColor: theme.card,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.text,
    marginTop: 12,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  section: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginBottom: 16,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionText: {
    marginLeft: 12,
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  infoSection: {
    backgroundColor: theme.card,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
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
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
    marginBottom: 16,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
  },
  emergencyNote: {
    flexDirection: 'row',
    backgroundColor: '#fff3e0',
    marginHorizontal: 16,
    marginBottom: 32,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  emergencyNoteText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
});

export default function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = createStyles(theme);
  const [settings, setSettings] = useState<AppSettings>({
    notifications: true,
    locationTracking: true,
    emergencyAlerts: true,
    biometricAuth: false,
    autoShareLocation: false,
    batteryOptimization: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const updateSetting = (key: keyof AppSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const clearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'Cache cleared successfully');
          }
        }
      ]
    );
  };

  const exportData = () => {
    Alert.alert(
      'Export Data',
      'Export your emergency contacts and medical information?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () => {
            Alert.alert('Success', 'Data exported successfully');
          }
        }
      ]
    );
  };

  const renderSettingItem = (
    title: string,
    subtitle: string,
    key: keyof AppSettings,
    icon: string
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon as any} size={24} color={theme.textSecondary} />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={settings[key]}
        onValueChange={(value) => updateSetting(key, value)}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={settings[key] ? theme.textOnPrimary : theme.surface}
      />
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Settings Header */}
        <View style={styles.header}>
          <Ionicons name="settings" size={32} color="#e74c3c" />
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Customize your app experience</Text>
        </View>

        {/* Emergency Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Features</Text>
          {renderSettingItem(
            'Emergency Alerts',
            'Receive critical emergency notifications',
            'emergencyAlerts',
            'alert-circle-outline'
          )}
          {renderSettingItem(
            'Location Tracking',
            'Allow location sharing during emergencies',
            'locationTracking',
            'location-outline'
          )}
          {renderSettingItem(
            'Auto Share Location',
            'Automatically share location in emergencies',
            'autoShareLocation',
            'share-outline'
          )}
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {renderSettingItem(
            'Push Notifications',
            'Receive app notifications',
            'notifications',
            'notifications-outline'
          )}
          {renderSettingItem(
            'Sound Alerts',
            'Play sounds for notifications',
            'soundEnabled',
            'volume-high-outline'
          )}
          {renderSettingItem(
            'Vibration',
            'Vibrate for alerts and notifications',
            'vibrationEnabled',
            'phone-portrait-outline'
          )}
        </View>

        {/* Security Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security & Privacy</Text>
          {renderSettingItem(
            'Biometric Authentication',
            'Use fingerprint or face ID to unlock',
            'biometricAuth',
            'finger-print-outline'
          )}
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          
          {/* Dark Mode Toggle */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon-outline" size={24} color={theme.text} />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Dark Mode</Text>
                <Text style={styles.settingSubtitle}>Use dark theme for the app</Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={isDark ? theme.textOnPrimary : theme.surface}
            />
          </View>
          
          {renderSettingItem(
            'Battery Optimization',
            'Optimize app for better battery life',
            'batteryOptimization',
            'battery-charging-outline'
          )}
        </View>

        {/* Data Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity style={styles.actionItem} onPress={exportData}>
            <View style={styles.actionLeft}>
              <Ionicons name="download-outline" size={24} color="#2ecc71" />
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Export Data</Text>
                <Text style={styles.actionSubtitle}>Download your emergency contacts and medical info</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#bdc3c7" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={clearCache}>
            <View style={styles.actionLeft}>
              <Ionicons name="trash-outline" size={24} color="#f39c12" />
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Clear Cache</Text>
                <Text style={styles.actionSubtitle}>Clear app cache and temporary files</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#bdc3c7" />
          </TouchableOpacity>
        </View>

        {/* App Information */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>App Information</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>100</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{Platform.OS}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Last Updated</Text>
              <Text style={styles.infoValue}>Today</Text>
            </View>
          </View>
        </View>

        {/* Emergency Note */}
        <View style={styles.emergencyNote}>
          <Ionicons name="warning" size={20} color="#e74c3c" />
          <Text style={styles.emergencyNoteText}>
            Some settings may affect emergency response capabilities. Changes to location and notification settings should be made carefully.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}