import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface NotificationData {
  type: 'emergency_alert';
  alertType: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
  contactName: string;
  urgency: 'critical' | 'high' | 'normal';
}

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as NotificationData;
    
    // Critical emergency notifications should always show
    if (data?.urgency === 'critical') {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      };
    }
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private notificationPermission: boolean = false;

  private constructor() {
    this.initializeNotifications();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initializeNotifications(): Promise<void> {
    try {
      // Request permissions
      await this.requestNotificationPermissions();
      
      // Get push token
      await this.registerForPushNotifications();
      
      // Configure notification categories for emergency alerts
      await this.setupNotificationCategories();
      
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  }

  private async requestNotificationPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true, // Critical alerts bypass Do Not Disturb
            allowAnnouncements: true,
          },
          android: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      this.notificationPermission = finalStatus === 'granted';
      return this.notificationPermission;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  private async registerForPushNotifications(): Promise<string | null> {
    try {
      if (!this.notificationPermission) {
        console.log('Notification permission not granted');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        // EAS project id from app.json → expo.extra.eas.projectId
        projectId: 'f9205a74-28bb-4abb-b289-13699fe0b32d',
      });

      this.expoPushToken = token.data;
      
      // Store token for emergency contacts to use
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);
      
      console.log('Expo push token:', this.expoPushToken);
      return this.expoPushToken;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  private async setupNotificationCategories(): Promise<void> {
    try {
      await Notifications.setNotificationCategoryAsync('emergency_alert', [
        {
          identifier: 'respond',
          buttonTitle: 'Respond',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: 'call_emergency',
          buttonTitle: 'Call 10111',
          options: {
            opensAppToForeground: false,
          },
        },
      ]);
    } catch (error) {
      console.error('Error setting up notification categories:', error);
    }
  }

  public async sendEmergencyNotificationToContacts(
    alertType: string,
    location?: { latitude: number; longitude: number },
    userName?: string
  ): Promise<number> {
    try {
      if (!this.notificationPermission) {
        console.log('Notification permission not available');
        return 0;
      }

      // Load emergency contacts
      const savedContacts = await AsyncStorage.getItem('emergencyContacts');
      if (!savedContacts) {
        console.log('No emergency contacts found');
        return 0;
      }

      const contacts: EmergencyContact[] = JSON.parse(savedContacts);
      if (contacts.length === 0) {
        return 0;
      }

      const senderName = userName || 'Emergency Contact';
      let locationText = '';
      
      if (location) {
        locationText = `\nLocation: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
      }

      let successCount = 0;

      // Send local notifications to simulate emergency contact notifications
      // In a real app, you would send these to the actual contacts' devices via a backend service
      for (const contact of contacts) {
        try {
          const notificationData: NotificationData = {
            type: 'emergency_alert',
            alertType,
            location,
            timestamp: Date.now(),
            contactName: contact.name,
            urgency: 'critical',
          };

          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🚨 EMERGENCY ALERT`,
              body: `${senderName} needs immediate help!\n\nAlert: ${alertType}${locationText}\n\nContact: ${contact.name} (${contact.relationship})`,
              data: notificationData,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              categoryIdentifier: 'emergency_alert',
              ...(Platform.OS === 'ios' && {
                interruptionLevel: 'critical', // iOS critical alerts
                criticalAlert: {
                  name: 'emergency',
                  volume: 1.0,
                },
              }),
            },
            trigger: {
              seconds: 1 + (successCount * 2), // Stagger notifications slightly
            },
          });

          successCount++;
          console.log(`Emergency notification scheduled for ${contact.name}`);
        } catch (error) {
          console.error(`Failed to send notification for ${contact.name}:`, error);
        }
      }

      // Send a summary notification to the user
      await this.sendUserConfirmationNotification(alertType, successCount, contacts.length);

      return successCount;
    } catch (error) {
      console.error('Error sending emergency notifications:', error);
      return 0;
    }
  }

  private async sendUserConfirmationNotification(
    alertType: string,
    successCount: number,
    totalContacts: number
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Emergency Alert Sent',
          body: `${alertType} alert sent to ${successCount}/${totalContacts} emergency contacts`,
          data: {
            type: 'confirmation',
            alertType,
            successCount,
            totalContacts,
          },
          sound: 'default',
        },
        trigger: {
          seconds: 5,
        },
      });
    } catch (error) {
      console.error('Error sending confirmation notification:', error);
    }
  }

  public async sendCriticalAlert(
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      if (!this.notificationPermission) {
        console.log('Notification permission not available for critical alert');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...data,
            urgency: 'critical',
          },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'ios' && {
            interruptionLevel: 'critical',
            criticalAlert: {
              name: 'emergency',
              volume: 1.0,
            },
          }),
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('Error sending critical alert:', error);
    }
  }

  public async testEmergencyNotification(): Promise<void> {
    try {
      await this.sendCriticalAlert(
        '🚨 TEST EMERGENCY ALERT',
        'This is a test of the emergency notification system. Your device is configured correctly.',
        { type: 'test' }
      );
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  public getNotificationPermissionStatus(): boolean {
    return this.notificationPermission;
  }

  public getPushToken(): string | null {
    return this.expoPushToken;
  }

  // Handle notification responses (when user taps notification actions)
  public setupNotificationResponseHandler(): void {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      
      if (data?.type === 'emergency_alert') {
        const actionIdentifier = response.actionIdentifier;
        
        switch (actionIdentifier) {
          case 'respond':
            // Handle respond action - could open chat or call
            console.log('User chose to respond to emergency alert');
            break;
          case 'call_emergency':
            // Handle emergency call action
            console.log('User chose to call emergency services');
            break;
          default:
            // Default tap - open app
            console.log('User tapped emergency notification');
            break;
        }
      }
    });
  }
}

export default NotificationService; 