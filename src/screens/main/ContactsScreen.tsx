import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Share,
  TextInput,
  Modal,
  ScrollView,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
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

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function ContactsScreen() {
  const { theme, isDark } = useTheme();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: '',
  });

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const savedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (savedContacts) {
        setContacts(JSON.parse(savedContacts));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const saveContacts = async (updatedContacts: EmergencyContact[]) => {
    try {
      await AsyncStorage.setItem('emergencyContacts', JSON.stringify(updatedContacts));
      setContacts(updatedContacts);
    } catch (error) {
      console.error('Error saving contacts:', error);
      Alert.alert('Error', 'Failed to save contact');
    }
  };

  const addContact = async () => {
    if (!newContact.name || !newContact.phone) {
      Alert.alert('Error', 'Please fill in name and phone number');
      return;
    }

    const contact: EmergencyContact = {
      id: Date.now().toString(),
      name: newContact.name,
      phone: newContact.phone,
      relationship: newContact.relationship || 'Emergency Contact',
    };

    const updatedContacts = [...contacts, contact];
    await saveContacts(updatedContacts);
    
    setNewContact({ name: '', phone: '', relationship: '' });
    setIsModalVisible(false);
    
    Alert.alert('Success', 'Emergency contact added successfully');
  };

  const removeContact = (contactId: string) => {
    Alert.alert(
      'Remove Contact',
      'Are you sure you want to remove this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedContacts = contacts.filter(c => c.id !== contactId);
            await saveContacts(updatedContacts);
          }
        }
      ]
    );
  };

  const sendEmergencyAlert = async () => {
    if (contacts.length === 0) {
      Alert.alert(
        'No Emergency Contacts',
        'Please add emergency contacts before sending alerts.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsLoading(true);
      Vibration.vibrate([0, 500, 200, 500]);

      // Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      let locationMessage = '';
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const locationUrl = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
        locationMessage = `\n\nMy location: ${locationUrl}`;
      }

      const userName = await AsyncStorage.getItem('user');
      const userInfo = userName ? JSON.parse(userName) : null;
      const name = userInfo?.fullName || 'Someone';

      const alertMessage = `🚨 EMERGENCY ALERT 🚨\n\n${name} needs help! This is an automated emergency message from the Safe Alert app.${locationMessage}\n\nPlease respond immediately or contact emergency services.`;

      // Send SMS if available
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        const phoneNumbers = contacts.map(c => c.phone);
        
        try {
          const { result } = await SMS.sendSMSAsync(phoneNumbers, alertMessage);
          
          if (result === 'sent') {
            Alert.alert(
              'Alert Sent',
              `Emergency alert sent to ${contacts.length} contact(s) with your live location.`,
              [{ text: 'OK' }]
            );
          } else {
            throw new Error('SMS not sent');
          }
        } catch (smsError) {
          // Fallback to share if SMS fails
          await Share.share({
            message: alertMessage,
            title: 'Emergency Alert',
          });
        }
      } else {
        // Fallback to share if SMS not available
        await Share.share({
          message: alertMessage,
          title: 'Emergency Alert',
        });
      }
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      Alert.alert('Error', 'Failed to send emergency alert');
    } finally {
      setIsLoading(false);
    }
  };

  const shareLocationWithContact = async (contact: EmergencyContact) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed to share location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const locationUrl = `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`;
      
      const userName = await AsyncStorage.getItem('user');
      const userInfo = userName ? JSON.parse(userName) : null;
      const name = userInfo?.fullName || 'Someone';

      const message = `📍 ${name} is sharing their location with you: ${locationUrl}`;

      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync([contact.phone], message);
        Alert.alert('Success', `Location shared with ${contact.name}`);
      } else {
        await Share.share({
          message: message,
          title: `Location from ${name}`,
        });
      }
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Error', 'Failed to share location');
    }
  };

  const getContactInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRelationshipColor = (relationship: string) => {
    switch (relationship.toLowerCase()) {
      case 'family':
      case 'parent':
      case 'spouse':
        return theme.hospital;
      case 'friend':
        return theme.contact;
      case 'doctor':
      case 'medical':
        return theme.security;
      case 'neighbor':
      case 'colleague':
        return theme.monitor;
      default:
        return theme.location;
    }
  };

  return (
    <Screen>
      <LinearGradient colors={theme.backgroundGradient} style={styles.container}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Header */}
            <GlassCard style={styles.header}>
              <View style={[styles.headerIcon, { backgroundColor: theme.contact }]}>
                <Ionicons name="people" size={32} color="#fff" />
              </View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Emergency Contacts</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {contacts.length} contact{contacts.length !== 1 ? 's' : ''} configured
              </Text>
            </GlassCard>

            {/* Emergency Alert Button */}
            <TouchableOpacity
              style={[styles.emergencyButton, { backgroundColor: theme.primary }, isLoading && styles.emergencyButtonDisabled]}
              onPress={sendEmergencyAlert}
              disabled={isLoading}
            >
              <Ionicons 
                name={isLoading ? "sync" : "warning"} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.emergencyButtonText}>
                {isLoading ? 'Sending Alert...' : 'Send Emergency Alert'}
              </Text>
            </TouchableOpacity>
            
            <GlassCard style={styles.emergencyInfo}>
              <Text style={[styles.emergencyInfoText, { color: theme.textSecondary }]}>
                Sends alert with your location to all emergency contacts
              </Text>
            </GlassCard>

            {/* Add Contact Button */}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.location }]}
              onPress={() => setIsModalVisible(true)}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add Emergency Contact</Text>
            </TouchableOpacity>

            {/* Contacts List */}
            {contacts.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Emergency Contacts</Text>
                {contacts.map((contact) => (
                  <GlassCard key={contact.id} style={styles.contactCard}>
                    <View style={styles.contactHeader}>
                      <View style={[styles.contactAvatar, { backgroundColor: getRelationshipColor(contact.relationship) }]}>
                        <Text style={styles.contactAvatarText}>
                          {getContactInitials(contact.name)}
                        </Text>
                      </View>
                      <View style={styles.contactInfo}>
                        <Text style={[styles.contactName, { color: theme.text }]}>
                          {contact.name}
                        </Text>
                        <Text style={[styles.contactPhone, { color: theme.textSecondary }]}>
                          {contact.phone}
                        </Text>
                        <View style={[styles.relationshipBadge, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.relationshipText, { color: theme.textSecondary }]}>
                            {contact.relationship}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.contactActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: theme.surface }]}
                        onPress={() => shareLocationWithContact(contact)}
                      >
                        <Ionicons name="location" size={16} color={theme.location} />
                        <Text style={[styles.actionButtonText, { color: theme.text }]}>
                          Share Location
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton, { backgroundColor: theme.surface }]}
                        onPress={() => removeContact(contact.id)}
                      >
                        <Ionicons name="trash" size={16} color={theme.primary} />
                        <Text style={[styles.actionButtonText, styles.deleteButtonText, { color: theme.primary }]}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                ))}
              </>
            ) : (
              <GlassCard style={styles.emptyState}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.monitor }]}>
                  <Ionicons name="people-outline" size={48} color="#fff" />
                </View>
                <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                  No Emergency Contacts
                </Text>
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                  Add emergency contacts to receive alerts when you need help
                </Text>
              </GlassCard>
            )}

            {/* Safety Tips */}
            <GlassCard style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Safety Tips</Text>
              <View style={styles.tipsContainer}>
                <View style={styles.tipItem}>
                  <View style={[styles.tipIcon, { backgroundColor: theme.hospital }]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                    Add family members and close friends
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={[styles.tipIcon, { backgroundColor: theme.hospital }]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                    Include at least 3 emergency contacts
                  </Text>
                </View>
                <View style={styles.tipItem}>
                  <View style={[styles.tipIcon, { backgroundColor: theme.hospital }]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </View>
                  <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                    Verify phone numbers are correct
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        </ScrollView>

        {/* Add Contact Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isModalVisible}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <LinearGradient colors={theme.backgroundGradient} style={styles.modalContainer}>
              <GlassCard style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    Add Emergency Contact
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setIsModalVisible(false)}
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name *</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: theme.surface,
                        color: theme.text,
                        borderColor: theme.borderGlass,
                      }]}
                      value={newContact.name}
                      onChangeText={(text) => setNewContact({...newContact, name: text})}
                      placeholder="Enter full name"
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number *</Text>
                    <TextInput
                      style={[styles.input, { 
                        backgroundColor: theme.surface,
                        color: theme.text,
                        borderColor: theme.borderGlass,
                      }]}
                      value={newContact.phone}
                      onChangeText={(text) => setNewContact({...newContact, phone: text})}
                      placeholder="Enter phone number"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: theme.text }]}>Relationship</Text>
                    <View style={styles.relationshipButtons}>
                      {['Family', 'Friend', 'Doctor', 'Neighbor', 'Emergency Contact'].map((rel) => (
                        <TouchableOpacity
                          key={rel}
                          style={[
                            styles.relationshipButton,
                            { 
                              backgroundColor: newContact.relationship === rel ? theme.primary : theme.surface,
                              borderColor: theme.borderGlass,
                            }
                          ]}
                          onPress={() => setNewContact({...newContact, relationship: rel})}
                        >
                          <Text style={[
                            styles.relationshipButtonText,
                            { 
                              color: newContact.relationship === rel ? '#fff' : theme.text,
                            }
                          ]}>
                            {rel}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.surface }]}
                    onPress={() => setIsModalVisible(false)}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.primary }]}
                    onPress={addContact}
                  >
                    <Text style={styles.saveButtonText}>Add Contact</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            </LinearGradient>
          </View>
        </Modal>
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
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  emergencyButton: {
    backgroundColor: '#e74c3c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  emergencyButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emergencyInfo: {
    marginBottom: 8,
  },
  emergencyInfoText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  addButton: {
    backgroundColor: '#f8f9fa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3498db',
    borderStyle: 'dashed',
  },
  addButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  contactsList: {
    gap: 12,
  },
  contactCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  relationshipBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  relationshipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#3498db',
  },
  deleteButton: {
    borderColor: '#e74c3c',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3498db',
    marginLeft: 4,
  },
  deleteButtonText: {
    color: '#e74c3c',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
  tipsContainer: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  tipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#2c3e50',
    marginLeft: 12,
    flex: 1,
  },
  relationshipButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationshipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  relationshipButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2c3e50',
  },
  relationshipButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationshipButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  relationshipButtonSelected: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  relationshipButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2c3e50',
  },
  relationshipButtonTextSelected: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3498db',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
}); 