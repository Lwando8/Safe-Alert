import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import GlassCard from '../../components/GlassCard';
import { useTheme } from '../../context/ThemeContext';

// Fallback for LinearGradient in Expo Go
let LinearGradient: any;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = View; // Fallback to regular View
}

interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  bloodType?: string;
  medicalAid?: string;
  medicalAidNumber?: string;
  allergies?: string;
  medications?: string;
  medicalConditions?: string;
}

const windowWidth = Dimensions.get('window').width;

const QuickAction = ({ 
  icon, 
  label, 
  color, 
  onPress 
}: { 
  icon: any; 
  label: string; 
  color: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.quickActionContainer} onPress={onPress}>
    <View style={[styles.quickActionIcon, { backgroundColor: color }]}> 
      {icon}
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      
      // Load user data
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        
        // Load additional profile data
        const profileData = await AsyncStorage.getItem('userProfile');
        const profile = profileData ? JSON.parse(profileData) : {};
        
        setUserProfile({
          fullName: user.fullName || '',
          email: user.email || '',
          phone: user.phone || '',
          ...profile
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('user');
              await AsyncStorage.removeItem('isAuthenticated');
              // Navigate to auth screen - in a real app, you'd handle this through navigation context
              Alert.alert('Success', 'You have been logged out');
            } catch (error) {
              console.error('Error logging out:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          }
        }
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const profileActions = [
    {
      title: 'Edit Profile',
      icon: <Ionicons name="person" size={24} color="#fff" />,
      color: theme.contact,
      onPress: () => navigation.navigate('EditProfile' as never)
    },
    {
      title: 'Medical Info',
      icon: <Ionicons name="medical" size={24} color="#fff" />,
      color: theme.hospital,
      onPress: () => navigation.navigate('MedicalInfo' as never)
    },
    {
      title: 'Settings',
      icon: <Ionicons name="settings" size={24} color="#fff" />,
      color: theme.monitor,
      onPress: () => navigation.navigate('Settings' as never)
    },
    {
      title: 'Emergency',
      icon: <Ionicons name="pulse" size={24} color="#fff" />,
      color: theme.location,
      onPress: () => navigation.navigate('EmergencyMonitoring' as never)
    }
  ];

  if (isLoading) {
    return (
      <Screen>
        <LinearGradient colors={theme.backgroundGradient} style={styles.container}>
          <View style={styles.loadingContainer}>
            <GlassCard style={styles.loadingCard}>
              <Text style={[styles.loadingText, { color: theme.text }]}>Loading profile...</Text>
            </GlassCard>
          </View>
        </LinearGradient>
      </Screen>
    );
  }

  return (
    <Screen>
      <LinearGradient colors={theme.backgroundGradient} style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Profile Header */}
            <GlassCard style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarText}>
                    {userProfile ? getInitials(userProfile.fullName) : 'UN'}
                  </Text>
                </View>
                <Text style={[styles.profileName, { color: theme.text }]}>
                  {userProfile?.fullName || 'User Name'}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                  {userProfile?.email || 'user@example.com'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <View style={styles.statusItem}>
                  <View style={[styles.statusIcon, { backgroundColor: theme.location }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </View>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Protected</Text>
                </View>
                <View style={styles.statusItem}>
                  <View style={[styles.statusIcon, { backgroundColor: theme.contact }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </View>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Connected</Text>
                </View>
                <View style={styles.statusItem}>
                  <View style={[styles.statusIcon, { backgroundColor: theme.monitor }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  </View>
                  <Text style={[styles.statusLabel, { color: theme.textSecondary }]}>Tracked</Text>
                </View>
              </View>
            </GlassCard>

            {/* Quick Actions */}
            <GlassCard style={styles.quickActionsCard}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                {profileActions.map((action, index) => (
                  <QuickAction
                    key={index}
                    icon={action.icon}
                    label={action.title}
                    color={action.color}
                    onPress={action.onPress}
                  />
                ))}
              </View>
            </GlassCard>

            {/* Personal Information */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
              <View style={styles.infoCard}>
                <View style={[styles.infoRow, { backgroundColor: theme.surface }]}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.contact }]}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Full Name</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {userProfile?.fullName || 'Not set'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.infoRow, { backgroundColor: theme.surface }]}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.location }]}>
                    <Ionicons name="mail" size={16} color="#fff" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Email</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {userProfile?.email || 'Not set'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.infoRow, { backgroundColor: theme.surface }]}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.monitor }]}>
                    <Ionicons name="call" size={16} color="#fff" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Phone</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {userProfile?.phone || 'Not set'}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* Medical Information */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Medical Information</Text>
              <View style={styles.infoCard}>
                <View style={[styles.infoRow, { backgroundColor: theme.surface }]}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.hospital }]}>
                    <Ionicons name="water" size={16} color="#fff" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Blood Type</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {userProfile?.bloodType || 'Not set'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.infoRow, { backgroundColor: theme.surface }]}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.contact }]}>
                    <Ionicons name="shield" size={16} color="#fff" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Medical Aid</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {userProfile?.medicalAid || 'Not set'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.infoRow, { backgroundColor: theme.surface }]}>
                  <View style={[styles.infoIcon, { backgroundColor: theme.location }]}>
                    <Ionicons name="warning" size={16} color="#fff" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Allergies</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {userProfile?.allergies || 'None specified'}
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>

            {/* Emergency Medical Info Card */}
            <GlassCard style={styles.emergencyCard}>
              <View style={styles.emergencyHeader}>
                <View style={[styles.emergencyIcon, { backgroundColor: theme.hospital }]}>
                  <Ionicons name="medical" size={20} color="#fff" />
                </View>
                <Text style={[styles.emergencyTitle, { color: theme.text }]}>Emergency Medical Info</Text>
              </View>
              <View style={styles.emergencyContent}>
                <Text style={[styles.emergencyText, { color: theme.textSecondary }]}>
                  This information is shared with first responders during emergencies
                </Text>
                <View style={styles.emergencyDetails}>
                  <Text style={[styles.emergencyDetailText, { color: theme.text }]}>
                    🩸 Blood Type: {userProfile?.bloodType || 'Not specified'}
                  </Text>
                  <Text style={[styles.emergencyDetailText, { color: theme.text }]}>
                    ⚠️ Allergies: {userProfile?.allergies || 'None specified'}
                  </Text>
                  <Text style={[styles.emergencyDetailText, { color: theme.text }]}>
                    💊 Medications: {userProfile?.medications || 'None specified'}
                  </Text>
                </View>
              </View>
            </GlassCard>

            {/* Settings Links */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>More Options</Text>
              <View style={styles.linksList}>
                <TouchableOpacity 
                  style={[styles.linkItem, { backgroundColor: theme.surface }]}
                  onPress={() => navigation.navigate('EmergencyContacts' as never)}
                >
                  <View style={[styles.linkIcon, { backgroundColor: theme.contact }]}>
                    <Ionicons name="people" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.linkText, { color: theme.text }]}>Emergency Contacts</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.linkItem, { backgroundColor: theme.surface }]}
                  onPress={() => navigation.navigate('PrivacyPolicy' as never)}
                >
                  <View style={[styles.linkIcon, { backgroundColor: theme.location }]}>
                    <Ionicons name="shield-checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.linkText, { color: theme.text }]}>Privacy Policy</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.linkItem, styles.lastLinkItem, { backgroundColor: theme.surface }]}
                  onPress={() => navigation.navigate('Terms' as never)}
                >
                  <View style={[styles.linkIcon, { backgroundColor: theme.monitor }]}>
                    <Ionicons name="document-text" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.linkText, { color: theme.text }]}>Terms of Service</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </GlassCard>

            {/* Logout Button */}
            <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.primary }]} onPress={logout}>
              <Ionicons name="log-out" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            {/* App Version */}
            <GlassCard style={styles.versionCard}>
              <Text style={[styles.versionText, { color: theme.textSecondary }]}>Safe Alert v1.0.0</Text>
            </GlassCard>
          </View>
        </ScrollView>
      </LinearGradient>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingCard: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#DC143C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontWeight: '600',
    fontSize: 14,
  },
  quickActionsCard: {
    marginBottom: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  quickActionContainer: {
    flex: 1,
    alignItems: 'center',
    minWidth: (windowWidth - 72) / 2, // Account for padding and gap
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  infoCard: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  emergencyCard: {
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  emergencyIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emergencyContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emergencyText: {
    fontSize: 14,
    marginBottom: 16,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  emergencyDetails: {
    gap: 8,
  },
  emergencyDetailText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  linksList: {
    gap: 12,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  lastLinkItem: {
    marginBottom: 0,
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#DC143C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  logoutText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  versionCard: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '500',
  },
}); 