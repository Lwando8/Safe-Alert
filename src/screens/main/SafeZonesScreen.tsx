import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Screen from '../../components/Screen';

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
    address?: string;
  };
  status: 'active' | 'last_seen' | 'offline';
  battery?: number;
}

export default function SafeZonesScreen() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactLocations, setContactLocations] = useState<ContactLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [myLocation, setMyLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    loadCommunityData();
    getCurrentLocation();
  }, []);

  const loadCommunityData = async () => {
    try {
      setIsLoading(true);
      
      // Load emergency contacts
      const savedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (savedContacts) {
        const contactsData = JSON.parse(savedContacts);
        setContacts(contactsData);
        
        // Simulate contact locations (in a real app, this would come from your backend)
        simulateContactLocations(contactsData);
      }
    } catch (error) {
      console.error('Error loading community data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setMyLocation(location);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  // Simulate contact locations (in a real app, this would be real-time data from your backend)
  const simulateContactLocations = (contactsData: EmergencyContact[]) => {
    const simulatedLocations: ContactLocation[] = contactsData.map((contact, index) => {
      // Generate random locations around a central point (for demo purposes)
      const baseLatitude = -26.2041; // Example: Johannesburg
      const baseLongitude = 28.0473;
      
      const latOffset = (Math.random() - 0.5) * 0.1; // ±0.05 degrees (~5km radius)
      const lngOffset = (Math.random() - 0.5) * 0.1;
      
      const statuses: ('active' | 'last_seen' | 'offline')[] = ['active', 'last_seen', 'offline'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      
      return {
        id: contact.id,
        name: contact.name,
        location: {
          latitude: baseLatitude + latOffset,
          longitude: baseLongitude + lngOffset,
          timestamp: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
        },
        status: randomStatus,
        battery: Math.floor(Math.random() * 100),
      };
    });
    
    setContactLocations(simulatedLocations);
  };

  const refreshLocations = async () => {
    setIsRefreshing(true);
    await loadCommunityData();
    setIsRefreshing(false);
  };

  const shareMyLocation = async () => {
    try {
      if (!myLocation) {
        await getCurrentLocation();
      }

      if (myLocation) {
        const locationUrl = `https://maps.google.com/?q=${myLocation.coords.latitude},${myLocation.coords.longitude}`;
        const userName = await AsyncStorage.getItem('user');
        const userInfo = userName ? JSON.parse(userName) : null;
        const name = userInfo?.fullName || 'Someone';

        const message = `📍 ${name} is sharing their live location with the community: ${locationUrl}`;

        await Share.share({
          message: message,
          title: 'Live Location from Safe Alert',
        });
      } else {
        Alert.alert('Location Unavailable', 'Unable to get your current location');
      }
    } catch (error) {
      console.error('Error sharing location:', error);
      Alert.alert('Error', 'Failed to share location');
    }
  };

  const getLocationAge = (timestamp: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return 'Yesterday';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return { icon: 'radio-button-on', color: '#2ecc71' };
      case 'last_seen': return { icon: 'time', color: '#f39c12' };
      case 'offline': return { icon: 'radio-button-off', color: '#bdc3c7' };
      default: return { icon: 'help', color: '#bdc3c7' };
    }
  };

  const openInMaps = (contact: ContactLocation) => {
    const url = `https://maps.google.com/?q=${contact.location.latitude},${contact.location.longitude}`;
    Share.share({
      message: `${contact.name}'s location: ${url}`,
      title: `${contact.name}'s Location`,
    });
  };

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Loading community...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Share Location Button */}
        <TouchableOpacity
          style={styles.shareLocationButton}
          onPress={shareMyLocation}
        >
          <Ionicons name="location" size={24} color="#fff" />
          <Text style={styles.shareLocationText}>Share My Location</Text>
        </TouchableOpacity>

        {/* Community Header */}
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>My Community</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshLocations}
            disabled={isRefreshing}
          >
            <Ionicons 
              name={isRefreshing ? "sync" : "refresh"} 
              size={20} 
              color="#e74c3c" 
            />
          </TouchableOpacity>
        </View>

        {/* Community Members */}
        <ScrollView style={styles.communityList} showsVerticalScrollIndicator={false}>
          {contacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#bdc3c7" />
              <Text style={styles.emptyText}>No community members yet</Text>
              <Text style={styles.emptySubText}>Add emergency contacts to see them here</Text>
            </View>
          ) : (
            contactLocations.map((contact) => {
              const statusInfo = getStatusIcon(contact.status);
              return (
                <TouchableOpacity
                  key={contact.id}
                  style={styles.communityItem}
                  onPress={() => openInMaps(contact)}
                >
                  <View style={styles.memberInfo}>
                    <View style={styles.memberHeader}>
                      <Text style={styles.memberName}>{contact.name}</Text>
                      <View style={styles.statusContainer}>
                        <Ionicons 
                          name={statusInfo.icon as any} 
                          size={12} 
                          color={statusInfo.color} 
                        />
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {contact.status === 'active' ? 'Live' : 
                           contact.status === 'last_seen' ? 'Last seen' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={styles.locationTime}>
                      {getLocationAge(contact.location.timestamp)}
                    </Text>
                    
                    {contact.battery !== undefined && (
                      <View style={styles.batteryContainer}>
                        <Ionicons 
                          name="battery-half" 
                          size={12} 
                          color={contact.battery > 20 ? '#2ecc71' : '#e74c3c'} 
                        />
                        <Text style={styles.batteryText}>{contact.battery}%</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.locationActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openInMaps(contact)}
                    >
                      <Ionicons name="navigate" size={20} color="#3498db" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={16} color="#7f8c8d" />
          <Text style={styles.infoText}>
            Location sharing requires consent from all community members
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  shareLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#3498db',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 24,
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
  shareLocationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  communityList: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#7f8c8d',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#bdc3c7',
    marginTop: 8,
    textAlign: 'center',
  },
  communityItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  locationTime: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginLeft: 4,
  },
  locationActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginLeft: 8,
    flex: 1,
  },
}); 