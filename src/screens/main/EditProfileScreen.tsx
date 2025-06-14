import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Screen from '../../components/Screen';

interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
  emergencyContactName: string;
  idNumber: string;
  occupation: string;
}

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    emergencyContactName: '',
    idNumber: '',
    occupation: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      
      // Load user data
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        
        // Load additional profile data
        const profileData = await AsyncStorage.getItem('userProfile');
        const additionalProfile = profileData ? JSON.parse(profileData) : {};
        
        setProfile({
          fullName: user.fullName || '',
          email: user.email || '',
          phone: user.phone || '',
          dateOfBirth: additionalProfile.dateOfBirth || '',
          address: additionalProfile.address || '',
          emergencyContact: additionalProfile.emergencyContact || '',
          emergencyContactName: additionalProfile.emergencyContactName || '',
          idNumber: additionalProfile.idNumber || '',
          occupation: additionalProfile.occupation || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      // Validate required fields
      if (!profile.fullName.trim() || !profile.email.trim() || !profile.phone.trim()) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      setIsSaving(true);

      // Update user data
      const userData = {
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
      };
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      // Update profile data
      const profileData = {
        dateOfBirth: profile.dateOfBirth,
        address: profile.address,
        emergencyContact: profile.emergencyContact,
        emergencyContactName: profile.emergencyContactName,
        idNumber: profile.idNumber,
        occupation: profile.occupation,
      };
      await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderInputField = (
    label: string,
    field: keyof UserProfile,
    placeholder: string,
    required: boolean = false,
    keyboardType: 'default' | 'email-address' | 'phone-pad' | 'numeric' = 'default'
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={profile[field]}
        onChangeText={(text) => updateField(field, text)}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
      />
    </View>
  );

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
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {profile.fullName
                .split(' ')
                .map(word => word.charAt(0))
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'NA'}
            </Text>
          </View>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Text style={styles.headerSubtitle}>Update your personal information</Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          {renderInputField('Full Name', 'fullName', 'Enter your full name', true)}
          {renderInputField('Email Address', 'email', 'Enter your email address', true, 'email-address')}
          {renderInputField('Phone Number', 'phone', 'Enter your phone number', true, 'phone-pad')}
          {renderInputField('Date of Birth', 'dateOfBirth', 'YYYY-MM-DD')}
          {renderInputField('ID Number', 'idNumber', 'Enter your ID number')}
          {renderInputField('Occupation', 'occupation', 'Enter your occupation')}
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={profile.address}
              onChangeText={(text) => updateField('address', text)}
              placeholder="Enter your physical address"
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          {renderInputField('Emergency Contact Name', 'emergencyContactName', 'Enter contact name')}
          {renderInputField('Emergency Contact Phone', 'emergencyContact', 'Enter contact phone number', false, 'phone-pad')}
        </View>

        {/* Important Notice */}
        <View style={styles.noticeContainer}>
          <Ionicons name="information-circle" size={20} color="#3498db" />
          <Text style={styles.noticeText}>
            Your information is securely stored and will only be used for emergency purposes and app functionality.
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveProfile}
          disabled={isSaving}
        >
          <Ionicons name={isSaving ? "sync" : "checkmark"} size={20} color="#fff" />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <TouchableOpacity style={styles.securityOption}>
            <View style={styles.securityOptionLeft}>
              <Ionicons name="lock-closed-outline" size={20} color="#7f8c8d" />
              <Text style={styles.securityOptionText}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#bdc3c7" />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.securityOption, styles.lastSecurityOption]}>
            <View style={styles.securityOptionLeft}>
              <Ionicons name="finger-print-outline" size={20} color="#7f8c8d" />
              <Text style={styles.securityOptionText}>Biometric Authentication</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#bdc3c7" />
          </TouchableOpacity>
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
  header: {
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
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
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 8,
  },
  required: {
    color: '#e74c3c',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    minHeight: 44,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noticeContainer: {
    flexDirection: 'row',
    backgroundColor: '#e8f4ff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  noticeText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3498db',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  securityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastSecurityOption: {
    borderBottomWidth: 0,
  },
  securityOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 12,
  },
}); 