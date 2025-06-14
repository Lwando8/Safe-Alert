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

const QuickAction = ({ icon, label, color }: { icon: any; label: string; color: string }) => (
  <View style={styles.quickActionContainer}>
    <View style={[styles.quickActionIcon, { backgroundColor: color }]}> 
      {icon}
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </View>
);

export default function ProfileScreen() {
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
      icon: 'person',
      color: '#4F8EF7',
      onPress: () => navigation.navigate('EditProfile' as never)
    },
    {
      title: 'Medical Info',
      icon: 'medical',
      color: '#F76B6B',
      onPress: () => navigation.navigate('MedicalInfo' as never)
    },
    {
      title: 'Settings',
      icon: 'settings',
      color: '#A259D9',
      onPress: () => navigation.navigate('Settings' as never)
    },
    {
      title: 'Emergency Monitor',
      icon: 'pulse',
      color: '#F7B801',
      onPress: () => navigation.navigate('EmergencyMonitoring' as never)
    }
  ];

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {userProfile ? getInitials(userProfile.fullName) : 'UN'}
              </Text>
            </View>
            <Text style={styles.profileName}>
              {userProfile?.fullName || 'User Name'}
            </Text>
            <Text style={styles.profileEmail}>
              {userProfile?.email || 'user@example.com'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={24} color="#2ecc40" />
              <Text style={styles.statusLabel}>Protected</Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={24} color="#2ecc40" />
              <Text style={styles.statusLabel}>Connected</Text>
            </View>
            <View style={styles.statusItem}>
              <Ionicons name="checkmark-circle" size={24} color="#2ecc40" />
              <Text style={styles.statusLabel}>Tracked</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            {profileActions.map((action, index) => (
              <QuickAction
                key={index}
                icon={<Ionicons name={action.icon as any} size={24} color="#fff" />}
                label={action.title}
                color={action.color}
              />
            ))}
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={20} color="#7f8c8d" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{userProfile?.fullName || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={20} color="#7f8c8d" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{userProfile?.email || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={20} color="#7f8c8d" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{userProfile?.phone || 'Not set'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Medical Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="water" size={20} color="#e74c3c" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Blood Type</Text>
                <Text style={styles.infoValue}>{userProfile?.bloodType || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="shield" size={20} color="#3498db" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Medical Aid</Text>
                <Text style={styles.infoValue}>{userProfile?.medicalAid || 'Not set'}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="warning" size={20} color="#f39c12" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Allergies</Text>
                <Text style={styles.infoValue}>{userProfile?.allergies || 'None specified'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Emergency Medical Info Card */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="medical" size={24} color="#e74c3c" />
            <Text style={styles.emergencyTitle}>Emergency Medical Info</Text>
          </View>
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyText}>
              This information is shared with first responders during emergencies
            </Text>
            <View style={styles.emergencyDetails}>
              <Text style={styles.emergencyDetailText}>
                🩸 Blood Type: {userProfile?.bloodType || 'Not specified'}
              </Text>
              <Text style={styles.emergencyDetailText}>
                ⚠️ Allergies: {userProfile?.allergies || 'None specified'}
              </Text>
              <Text style={styles.emergencyDetailText}>
                💊 Medications: {userProfile?.medications || 'None specified'}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Options</Text>
          <View style={styles.linksList}>
            <TouchableOpacity 
              style={styles.linkItem}
              onPress={() => navigation.navigate('EmergencyContacts' as never)}
            >
              <Ionicons name="people" size={20} color="#3498db" />
              <Text style={styles.linkText}>Emergency Contacts</Text>
              <Ionicons name="chevron-forward" size={16} color="#bdc3c7" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.linkItem}
              onPress={() => navigation.navigate('PrivacyPolicy' as never)}
            >
              <Ionicons name="shield-checkmark" size={20} color="#27ae60" />
              <Text style={styles.linkText}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={16} color="#bdc3c7" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.linkItem, styles.lastLinkItem]}
              onPress={() => navigation.navigate('Terms' as never)}
            >
              <Ionicons name="document-text" size={20} color="#8e44ad" />
              <Text style={styles.linkText}>Terms of Service</Text>
              <Ionicons name="chevron-forward" size={16} color="#bdc3c7" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out" size={20} color="#fff" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Safe Alert v1.0.0</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  profileHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F76B6B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 18,
  },
  statusItem: {
    alignItems: 'center',
    marginHorizontal: 18,
  },
  statusLabel: {
    color: '#2ecc40',
    fontWeight: '600',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
    color: '#2c3e50',
    marginBottom: 16,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: windowWidth * 0.9,
    marginBottom: 12,
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
  infoCard: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  emergencyCard: {
    backgroundColor: '#fff3e0',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e74c3c',
    marginLeft: 8,
  },
  emergencyContent: {
    padding: 16,
  },
  emergencyText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  emergencyDetails: {
    gap: 8,
  },
  emergencyDetailText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
  },
  linksList: {
    gap: 0,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastLinkItem: {
    borderBottomWidth: 0,
  },
  linkText: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 12,
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#e74c3c',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 32,
  },
  versionText: {
    fontSize: 12,
    color: '#bdc3c7',
  },
}); 