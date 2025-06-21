import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export default function EmergencyContactsScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
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

  const getInitials = (name: string) => {
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
      case 'colleague':
      case 'work':
        return theme.monitor;
      default:
        return theme.location;
    }
  };

  return (
    <Screen>
      <LinearGradient colors={theme.backgroundGradient} style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Title Card */}
            <GlassCard style={styles.titleCard}>
              <View style={[styles.iconContainer, { backgroundColor: theme.contact }]}>
                <Ionicons name="people" size={32} color="#fff" />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>Emergency Contacts</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Manage your emergency contact list
              </Text>
            </GlassCard>

            {/* Add Contact Button */}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: theme.primary }]}
              onPress={() => setIsModalVisible(true)}
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add Emergency Contact</Text>
            </TouchableOpacity>

            {/* Info Card */}
            <GlassCard style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <View style={[styles.infoIcon, { backgroundColor: theme.location }]}>
                  <Ionicons name="information-circle" size={20} color="#fff" />
                </View>
                <Text style={[styles.infoTitle, { color: theme.text }]}>
                  Important Information
                </Text>
              </View>
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                These contacts will be notified automatically during emergency situations. Make sure their information is current and they're aware of their role as your emergency contact.
              </Text>
            </GlassCard>

            {/* Contacts List */}
            {contacts.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.monitor }]}>
                  <Ionicons name="person-add" size={32} color="#fff" />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  No Emergency Contacts
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Add your first emergency contact to get started. We recommend adding at least 2-3 contacts.
                </Text>
              </GlassCard>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Your Emergency Contacts ({contacts.length})
                </Text>
                {contacts.map((contact, index) => (
                  <GlassCard key={contact.id} style={styles.contactCard}>
                    <View style={styles.contactHeader}>
                      <View style={[styles.avatarContainer, { backgroundColor: getRelationshipColor(contact.relationship) }]}>
                        <Text style={styles.avatarText}>
                          {getInitials(contact.name)}
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
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeContact(contact.id)}
                      >
                        <Ionicons name="trash" size={20} color={theme.primary} />
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                ))}
              </>
            )}
          </ScrollView>
        </View>

        {/* Add Contact Modal */}
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
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

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.borderGlass,
                    }]}
                    placeholder="Enter full name"
                    placeholderTextColor={theme.textSecondary}
                    value={newContact.name}
                    onChangeText={(text) => setNewContact(prev => ({ ...prev, name: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.borderGlass,
                    }]}
                    placeholder="Enter phone number"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="phone-pad"
                    value={newContact.phone}
                    onChangeText={(text) => setNewContact(prev => ({ ...prev, phone: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.text }]}>Relationship</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: theme.surface,
                      color: theme.text,
                      borderColor: theme.borderGlass,
                    }]}
                    placeholder="e.g., Family, Friend, Spouse"
                    placeholderTextColor={theme.textSecondary}
                    value={newContact.relationship}
                    onChangeText={(text) => setNewContact(prev => ({ ...prev, relationship: text }))}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.surface }]}
                    onPress={() => setIsModalVisible(false)}
                  >
                    <Text style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.addModalButton, { backgroundColor: theme.primary }]}
                    onPress={addContact}
                  >
                    <Text style={styles.addModalButtonText}>Add Contact</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  titleCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#E67E62',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  infoCard: {
    marginBottom: 20,
    paddingVertical: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  contactCard: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  contactPhone: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 6,
  },
  relationshipBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  relationshipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addModalButton: {},
  addModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
}); 