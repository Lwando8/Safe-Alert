import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  RefreshControl,
  Linking,
  StatusBar,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
// LinearGradient fallback handling
let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch (error) {
  LinearGradient = View; // Fallback to View if expo-linear-gradient is not available
}
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// Components
import Screen from '../components/Screen';
import GlassCard from '../components/GlassCard';
import BlurOverlay from '../components/BlurOverlay';
import AddEmergencyContactModal from '../components/AddEmergencyContactModal';
import { useTheme } from '../context/ThemeContext';

const { width: windowWidth } = Dimensions.get('window');

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface ContactLocation {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  status: 'sharing' | 'last_seen' | 'not_sharing';
  battery?: number;
  accuracy?: number;
}

interface PhoneContact {
  id: string;
  name: string;
  phoneNumbers: { number: string }[];
}

const MyCommunityScreen = () => {
  const { theme, isDark } = useTheme();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactLocations, setContactLocations] = useState<ContactLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);
  const [selectedContact, setSelectedContact] = useState<ContactLocation | null>(null);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  
  // Contact management states
  const [isContactModalVisible, setIsContactModalVisible] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: 'Family',
  });
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([]);
  const [filteredPhoneContacts, setFilteredPhoneContacts] = useState<PhoneContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsPermission, setContactsPermission] = useState<boolean>(false);

  useEffect(() => {
    loadCommunityData();
    getCurrentLocation();
    
    // Simulate real-time updates every 30 seconds
    const interval = setInterval(() => {
      if (contacts.length > 0) {
        updateContactLocations();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [contacts.length]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setMyLocation(location);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  const loadCommunityData = async () => {
    try {
      setIsLoading(true);
      
      // Load emergency contacts
      const savedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (savedContacts) {
        const contactsData = JSON.parse(savedContacts);
        setContacts(contactsData);
        
        // Load or simulate contact locations
        await loadContactLocations(contactsData);
      }
    } catch (error) {
      console.error('Error loading community data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadContactLocations = async (contactsData: EmergencyContact[]) => {
    try {
      // In a real app, this would fetch from your backend API
      // For now, we'll simulate realistic location data
      const simulatedLocations: ContactLocation[] = contactsData.map((contact, index) => {
        // Generate locations around major cities in South Africa
        const cities = [
          { lat: -26.2041, lng: 28.0473, name: 'Johannesburg' },
          { lat: -33.9249, lng: 18.4241, name: 'Cape Town' },
          { lat: -29.8587, lng: 31.0218, name: 'Durban' },
          { lat: -25.7479, lng: 28.2293, name: 'Pretoria' },
        ];
        
        const randomCity = cities[index % cities.length];
        const latOffset = (Math.random() - 0.5) * 0.05; // ±2.5km
        const lngOffset = (Math.random() - 0.5) * 0.05;
        
        const statuses: ('sharing' | 'last_seen' | 'not_sharing')[] = ['sharing', 'last_seen', 'not_sharing'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        return {
          id: contact.id,
          name: contact.name,
          location: {
            latitude: randomCity.lat + latOffset,
            longitude: randomCity.lng + lngOffset,
            timestamp: new Date(Date.now() - Math.random() * 1800000), // Random time within last 30 minutes
          },
          status: randomStatus,
          battery: Math.floor(Math.random() * 100),
          accuracy: Math.floor(Math.random() * 50) + 5, // 5-55 meters
        };
      });
      
      setContactLocations(simulatedLocations);
    } catch (error) {
      console.error('Error loading contact locations:', error);
    }
  };

  const updateContactLocations = async () => {
    // Simulate location updates for contacts that are sharing
    setContactLocations(prevLocations => 
      prevLocations.map(contact => {
        if (contact.status === 'sharing') {
          // Small random movement to simulate real movement
          const latOffset = (Math.random() - 0.5) * 0.001; // ~100m
          const lngOffset = (Math.random() - 0.5) * 0.001;
          
          return {
            ...contact,
            location: {
              latitude: contact.location.latitude + latOffset,
              longitude: contact.location.longitude + lngOffset,
              timestamp: new Date(),
            },
            battery: Math.max(0, contact.battery! - Math.floor(Math.random() * 3)),
          };
        }
        return contact;
      })
    );
  };

  const refreshCommunity = async () => {
    setIsRefreshing(true);
    await loadCommunityData();
    setIsRefreshing(false);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'sharing':
        return { color: '#2ecc71', icon: 'radio-button-on', text: 'Live' };
      case 'last_seen':
        return { color: '#f39c12', icon: 'time', text: 'Last seen' };
      case 'not_sharing':
        return { color: '#95a5a6', icon: 'radio-button-off', text: 'Not sharing' };
      default:
        return { color: '#95a5a6', icon: 'radio-button-off', text: 'Unknown' };
    }
  };

  const getLocationAge = (timestamp: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return `${Math.floor(diffMinutes / 1440)}d ago`;
  };

  const openContactLocation = (contact: ContactLocation) => {
    setSelectedContact(contact);
    setIsMapModalVisible(true);
  };

  const openInMaps = (contact: ContactLocation) => {
    const { latitude, longitude } = contact.location;
    const label = encodeURIComponent(contact.name);
    
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}(${label})`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Unable to open maps application');
      });
    }
  };

  const requestLocationFromContact = (contact: EmergencyContact) => {
    Alert.alert(
      'Request Location',
      `Send a location request to ${contact.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: () => {
            // In a real app, this would send a push notification or SMS
            Alert.alert(
              'Request Sent',
              `Location request sent to ${contact.name}. They will be notified to share their location.`
            );
          },
        },
      ]
    );
  };

  const shareMyLocation = async () => {
    if (!locationPermission) {
      Alert.alert(
        'Location Permission Required',
        'Please enable location access to share your location with emergency contacts.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    try {
      if (!myLocation) {
        await getCurrentLocation();
      }

      Alert.alert(
        'Share Location',
        'This will share your live location with all emergency contacts for the next hour.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Share',
            onPress: () => {
              // In a real app, this would enable location sharing
              Alert.alert('Success', 'Your location is now being shared with your emergency contacts.');
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Unable to share location. Please try again.');
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
    const colors: Record<string, string> = {
      Family: theme.emergency,
      Friend: theme.security,
      Doctor: theme.hospital,
      Neighbor: theme.monitor,
      'Emergency Contact': theme.profile,
    };
    return colors[relationship] || theme.textSecondary;
  };

  // Contact Management Functions
  const showAddContactManually = () => {
    setNewContact({ name: '', phone: '', relationship: 'Family' });
    setIsContactModalVisible(true);
  };

  const submitNewEmergencyContact = async () => {
    setIsSavingContact(true);
    try {
      await addEmergencyContact(
        newContact.name.trim(),
        newContact.phone.trim(),
        newContact.relationship || 'Emergency Contact'
      );
    } finally {
      setIsSavingContact(false);
    }
  };

  const addEmergencyContact = async (contactName: string, phoneNumber: string, relationship: string) => {
    try {
      if (!phoneNumber || !contactName) {
        Alert.alert('Error', 'Please provide contact name and phone number');
        return;
      }

      // Check if contact already exists
      const existingContact = contacts.find(c => 
        c.phone === phoneNumber || c.name === contactName
      );

      if (existingContact) {
        Alert.alert('Contact Exists', 'This contact is already in your emergency contacts');
        return;
      }

      const newEmergencyContact: EmergencyContact = {
        id: Date.now().toString(),
        name: contactName,
        phone: phoneNumber,
        relationship: relationship,
      };

      const updatedContacts = [...contacts, newEmergencyContact];
      await saveEmergencyContacts(updatedContacts);
      
      setIsContactModalVisible(false);
      Alert.alert('Success', `${contactName} added to emergency contacts`);
      
    } catch (error) {
      console.error('Error adding emergency contact:', error);
      Alert.alert('Error', 'Failed to add emergency contact');
    }
  };

  const removeEmergencyContact = (contactId: string) => {
    const contactToRemove = contacts.find(c => c.id === contactId);
    if (!contactToRemove) return;

    Alert.alert(
      'Remove Emergency Contact',
      `Remove ${contactToRemove.name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedContacts = contacts.filter(c => c.id !== contactId);
              await saveEmergencyContacts(updatedContacts);
              Alert.alert('Success', `${contactToRemove.name} removed from emergency contacts`);
            } catch (error) {
              console.error('Error removing contact:', error);
              Alert.alert('Error', 'Failed to remove contact');
            }
          }
        }
      ]
    );
  };

  const saveEmergencyContacts = async (updatedContacts: EmergencyContact[]) => {
    try {
      await AsyncStorage.setItem('emergencyContacts', JSON.stringify(updatedContacts));
      setContacts(updatedContacts);
      
      // Update location data for new contacts
      await loadContactLocations(updatedContacts);
    } catch (error) {
      console.error('Error saving emergency contacts:', error);
      throw error;
    }
  };

  const openContactImportModal = () => {
    showAddContactManually();
  };

  if (isLoading) {
    return (
      <Screen>
        <StatusBar 
          barStyle={isDark ? 'light-content' : 'dark-content'} 
          backgroundColor="transparent"
          translucent
        />
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading your community...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor="transparent"
        translucent
      />
      
      {/* Background Gradient */}
      <View style={[styles.gradientBackground, { backgroundColor: theme.background }]}>
        <View style={[styles.gradientOverlay, { 
          backgroundColor: isDark 
            ? 'rgba(99, 102, 241, 0.1)' 
            : 'rgba(139, 69, 19, 0.05)' 
        }]} />
      </View>

      <BlurOverlay position="bottom" height={88} backgroundColor={theme.card} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshCommunity}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <GlassCard intensity={20} style={styles.headerCard}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>My Community</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {contactLocations.filter(c => c.status === 'sharing').length} of {contacts.length}{' '}
                sharing live location
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.shareButton,
                {
                  backgroundColor: theme.primaryGlass,
                  borderColor: theme.border,
                },
              ]}
              onPress={shareMyLocation}
            >
              <Ionicons name="location" size={18} color={theme.primary} />
              <Text style={[styles.shareButtonText, { color: theme.text }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
        {contacts.length === 0 ? (
          <GlassCard style={styles.emptyStateCard}>
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={80} color={theme.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No Community Members</Text>
              <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                Add emergency contacts to see them in your community and share locations with each other.
              </Text>
              <TouchableOpacity
                style={[styles.addContactsButton, { backgroundColor: theme.primary }]}
                onPress={openContactImportModal}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addContactsButtonText}>Add Emergency Contacts</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : (
          <View style={styles.communityList}>
            {contacts.map((contact) => {
              const locationData = contactLocations.find(cl => cl.id === contact.id);
              const statusInfo = locationData ? getStatusInfo(locationData.status) : getStatusInfo('not_sharing');
              
              return (
                <GlassCard key={contact.id} style={styles.contactCard}>
                  <TouchableOpacity
                    style={styles.contactTouchable}
                    onPress={() => locationData ? openContactLocation(locationData) : requestLocationFromContact(contact)}
                    onLongPress={() => removeEmergencyContact(contact.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contactContent}>
                      <View style={styles.contactLeft}>
                        <View style={[
                          styles.contactAvatar,
                          { backgroundColor: getRelationshipColor(contact.relationship) }
                        ]}>
                          <Text style={styles.contactAvatarText}>
                            {getContactInitials(contact.name)}
                          </Text>
                        </View>
                        <View style={styles.contactInfo}>
                          <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>
                            {contact.name}
                          </Text>
                          <View style={styles.statusRow}>
                            <Ionicons
                              name={statusInfo.icon as keyof typeof Ionicons.glyphMap}
                              size={12}
                              color={statusInfo.color}
                            />
                            <Text
                              style={[styles.statusText, { color: statusInfo.color }]}
                              numberOfLines={1}
                            >
                              {statusInfo.text}
                            </Text>
                            {locationData && locationData.status !== 'not_sharing' && (
                              <Text
                                style={[styles.locationTime, { color: theme.textSecondary }]}
                                numberOfLines={1}
                              >
                                • {getLocationAge(locationData.location.timestamp)}
                              </Text>
                            )}
                          </View>
                          <Text
                            style={[styles.relationshipText, { color: theme.textSecondary }]}
                            numberOfLines={1}
                          >
                            {contact.relationship}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.contactRight}>
                        {locationData && locationData.status === 'sharing' && locationData.battery && (
                          <View style={styles.batteryContainer}>
                            <Ionicons 
                              name="battery-half" 
                              size={16} 
                              color={locationData.battery > 20 ? theme.location : theme.contact} 
                            />
                            <Text style={[styles.batteryText, { color: theme.textSecondary }]}>{locationData.battery}%</Text>
                          </View>
                        )}
                        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </View>
        )}

        {/* Safety Tips */}
        {contacts.length > 0 && (
          <GlassCard style={styles.tipsSection}>
            <Text style={[styles.tipsSectionTitle, { color: theme.text }]}>Location Sharing Tips</Text>
            <View style={styles.tipsContainer}>
              <View style={styles.tipItem}>
                <Ionicons name="shield-checkmark" size={16} color={theme.location} />
                <Text style={[styles.tipText, { color: theme.textSecondary }]}>Location sharing is end-to-end encrypted</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="time" size={16} color={theme.primary} />
                <Text style={[styles.tipText, { color: theme.textSecondary }]}>Shared locations expire after 24 hours</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="settings" size={16} color={theme.textSecondary} />
                <Text style={[styles.tipText, { color: theme.textSecondary }]}>You can stop sharing anytime in settings</Text>
              </View>
            </View>
          </GlassCard>
        )}
      </ScrollView>

      {contacts.length > 0 && (
        <TouchableOpacity
          style={[styles.addContactFAB, { backgroundColor: theme.primary }]}
          onPress={openContactImportModal}
        >
          <Ionicons name="person-add" size={24} color={theme.textOnPrimary} />
        </TouchableOpacity>
      )}

      {/* Map Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={isMapModalVisible}
        onRequestClose={() => setIsMapModalVisible(false)}
      >
        <View style={styles.mapModalContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity
              style={styles.mapCloseButton}
              onPress={() => setIsMapModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#2c3e50" />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>
              {selectedContact?.name}'s Location
            </Text>
            <TouchableOpacity
              style={styles.mapDirectionsButton}
              onPress={() => selectedContact && openInMaps(selectedContact)}
            >
              <Ionicons name="navigate" size={20} color="#3498db" />
            </TouchableOpacity>
          </View>
          
          {selectedContact && (
            <>
              <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude: selectedContact.location.latitude,
                  longitude: selectedContact.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                showsUserLocation={locationPermission}
                showsMyLocationButton={true}
              >
                <Marker
                  coordinate={{
                    latitude: selectedContact.location.latitude,
                    longitude: selectedContact.location.longitude,
                  }}
                  title={selectedContact.name}
                  description={`Last updated: ${getLocationAge(selectedContact.location.timestamp)}`}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.marker, { backgroundColor: getStatusInfo(selectedContact.status).color }]}>
                      <Text style={styles.markerText}>
                        {getContactInitials(selectedContact.name)}
                      </Text>
                    </View>
                  </View>
                </Marker>
              </MapView>
              
              <View style={styles.mapInfo}>
                <View style={styles.mapInfoRow}>
                  <Ionicons name="time" size={16} color="#7f8c8d" />
                  <Text style={styles.mapInfoText}>
                    Last updated: {getLocationAge(selectedContact.location.timestamp)}
                  </Text>
                </View>
                {selectedContact.accuracy && (
                  <View style={styles.mapInfoRow}>
                    <Ionicons name="locate" size={16} color="#7f8c8d" />
                    <Text style={styles.mapInfoText}>
                      Accuracy: ±{selectedContact.accuracy}m
                    </Text>
                  </View>
                )}
                {selectedContact.battery && (
                  <View style={styles.mapInfoRow}>
                    <Ionicons name="battery-half" size={16} color="#7f8c8d" />
                    <Text style={styles.mapInfoText}>
                      Battery: {selectedContact.battery}%
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>

      <AddEmergencyContactModal
        visible={isContactModalVisible}
        value={newContact}
        onChange={setNewContact}
        onClose={() => setIsContactModalVisible(false)}
        onSave={submitNewEmergencyContact}
        saving={isSavingContact}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  // Glass morphism background styles
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  headerCard: {
    marginHorizontal: 16,
    marginTop: Platform.OS === 'ios' ? 8 : 12,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 120,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateCard: {
    marginHorizontal: 16,
    marginTop: 40,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 24,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  addContactsButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    ...Platform.select({
      ios: {
        shadowColor: '#3498db',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  addContactsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  communityList: {
    paddingHorizontal: 16,
  },
  contactCard: {
    marginBottom: 12,
  },
  contactTouchable: {
    borderRadius: 16,
  },
  contactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    minWidth: 0,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
    flexShrink: 1,
  },
  locationTime: {
    fontSize: 12,
    flexShrink: 1,
  },
  relationshipText: {
    fontSize: 12,
  },
  contactRight: {
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  batteryText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginLeft: 2,
  },
  tipsSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  tipsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  tipsContainer: {
    gap: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  // Map Modal Styles
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  mapCloseButton: {
    padding: 8,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'center',
  },
  mapDirectionsButton: {
    padding: 8,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  mapInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  mapInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapInfoText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 8,
  },
  addContactFAB: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 100 : 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    zIndex: 200,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#3498db',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  contactModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '90%',
  },
  contactModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  contactModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  contactModalCloseButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
  },
  contactsLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  contactsLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  contactsList: {
    maxHeight: 400,
  },
  phoneContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  phoneContactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phoneContactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  phoneContactAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  phoneContactDetails: {
    flex: 1,
  },
  phoneContactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 2,
  },
  phoneContactNumber: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  emptyContactsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyContactsText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#3498db',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  contactModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  contactModalFooterText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default MyCommunityScreen;