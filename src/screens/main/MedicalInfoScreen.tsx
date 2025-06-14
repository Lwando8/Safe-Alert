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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Screen from '../../components/Screen';

interface MedicalInfo {
  bloodType: string;
  allergies: string;
  medications: string;
  medicalConditions: string;
  medicalAid: string;
  medicalAidNumber: string;
  doctorName: string;
  doctorPhone: string;
  emergencyMedicalContact: string;
  weight: string;
  height: string;
  chronicConditions: string;
  disabilities: string;
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function MedicalInfoScreen() {
  const [medicalInfo, setMedicalInfo] = useState<MedicalInfo>({
    bloodType: '',
    allergies: '',
    medications: '',
    medicalConditions: '',
    medicalAid: '',
    medicalAidNumber: '',
    doctorName: '',
    doctorPhone: '',
    emergencyMedicalContact: '',
    weight: '',
    height: '',
    chronicConditions: '',
    disabilities: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showBloodTypePicker, setShowBloodTypePicker] = useState(false);

  useEffect(() => {
    loadMedicalInfo();
  }, []);

  const loadMedicalInfo = async () => {
    try {
      setIsLoading(true);
      const savedMedicalInfo = await AsyncStorage.getItem('medicalInfo');
      if (savedMedicalInfo) {
        setMedicalInfo(JSON.parse(savedMedicalInfo));
      }
    } catch (error) {
      console.error('Error loading medical info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMedicalInfo = async () => {
    try {
      setIsSaving(true);
      await AsyncStorage.setItem('medicalInfo', JSON.stringify(medicalInfo));
      
      // Also update the userProfile for quick access
      const profileData = await AsyncStorage.getItem('userProfile');
      const profile = profileData ? JSON.parse(profileData) : {};
      
      const updatedProfile = {
        ...profile,
        bloodType: medicalInfo.bloodType,
        allergies: medicalInfo.allergies,
        medications: medicalInfo.medications,
        medicalConditions: medicalInfo.medicalConditions,
        medicalAid: medicalInfo.medicalAid,
        medicalAidNumber: medicalInfo.medicalAidNumber,
      };
      
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      
      Alert.alert('Success', 'Medical information saved successfully');
    } catch (error) {
      console.error('Error saving medical info:', error);
      Alert.alert('Error', 'Failed to save medical information');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof MedicalInfo, value: string) => {
    setMedicalInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderInputField = (
    label: string,
    field: keyof MedicalInfo,
    placeholder: string,
    multiline: boolean = false,
    keyboardType: 'default' | 'phone-pad' | 'numeric' = 'default'
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={medicalInfo[field]}
        onChangeText={(text) => updateField(field, text)}
        placeholder={placeholder}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        keyboardType={keyboardType}
      />
    </View>
  );

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading medical information...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Emergency Medical Info Header */}
        <View style={styles.emergencyHeader}>
          <Ionicons name="medical" size={24} color="#e74c3c" />
          <Text style={styles.emergencyTitle}>Emergency Medical Information</Text>
        </View>

        {/* Basic Medical Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Blood Type *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowBloodTypePicker(true)}
            >
              <Text style={[styles.pickerText, !medicalInfo.bloodType && styles.placeholderText]}>
                {medicalInfo.bloodType || 'Select blood type'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#7f8c8d" />
            </TouchableOpacity>
          </View>

          {renderInputField('Weight (kg)', 'weight', 'Enter your weight', false, 'numeric')}
          {renderInputField('Height (cm)', 'height', 'Enter your height', false, 'numeric')}
        </View>

        {/* Medical Conditions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Conditions</Text>
          {renderInputField('Allergies', 'allergies', 'List any allergies (medications, food, environmental)', true)}
          {renderInputField('Current Medications', 'medications', 'List all current medications and dosages', true)}
          {renderInputField('Medical Conditions', 'medicalConditions', 'List any current medical conditions', true)}
          {renderInputField('Chronic Conditions', 'chronicConditions', 'List any chronic conditions', true)}
          {renderInputField('Disabilities', 'disabilities', 'List any disabilities or special needs', true)}
        </View>

        {/* Medical Aid Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Aid Information</Text>
          {renderInputField('Medical Aid Provider', 'medicalAid', 'e.g., Discovery Health, Momentum, etc.')}
          {renderInputField('Medical Aid Number', 'medicalAidNumber', 'Your medical aid membership number')}
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Emergency Contacts</Text>
          {renderInputField('Doctor Name', 'doctorName', 'Your primary doctor\'s name')}
          {renderInputField('Doctor Phone', 'doctorPhone', 'Doctor\'s phone number', false, 'phone-pad')}
          {renderInputField('Emergency Medical Contact', 'emergencyMedicalContact', 'Emergency contact with medical authority', false, 'phone-pad')}
        </View>

        {/* Important Notice */}
        <View style={styles.noticeContainer}>
          <Ionicons name="information-circle" size={20} color="#f39c12" />
          <Text style={styles.noticeText}>
            This information will be accessible during emergencies to help first responders provide appropriate care.
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveMedicalInfo}
          disabled={isSaving}
        >
          <Ionicons name={isSaving ? "sync" : "checkmark"} size={20} color="#fff" />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Medical Information'}
          </Text>
        </TouchableOpacity>

        {/* Blood Type Picker Modal */}
        <Modal
          visible={showBloodTypePicker}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowBloodTypePicker(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Select Blood Type</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.modalContent}>
              {BLOOD_TYPES.map((bloodType) => (
                <TouchableOpacity
                  key={bloodType}
                  style={styles.bloodTypeOption}
                  onPress={() => {
                    updateField('bloodType', bloodType);
                    setShowBloodTypePicker(false);
                  }}
                >
                  <Text style={styles.bloodTypeText}>{bloodType}</Text>
                  {medicalInfo.bloodType === bloodType && (
                    <Ionicons name="checkmark" size={20} color="#e74c3c" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
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
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
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
  emergencyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e74c3c',
    marginLeft: 12,
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
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fafafa',
    minHeight: 44,
  },
  pickerText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  placeholderText: {
    color: '#bdc3c7',
  },
  noticeContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff9e6',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
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
    backgroundColor: '#2ecc71',
    marginHorizontal: 16,
    marginBottom: 32,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
  },
  cancelButton: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  modalContent: {
    padding: 16,
  },
  bloodTypeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bloodTypeText: {
    fontSize: 18,
    color: '#2c3e50',
  },
}); 