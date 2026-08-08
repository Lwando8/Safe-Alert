import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExpoProjectId, registerCurrentDevice } from './PlatformClient';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface NotificationData {
  type: 'emergency_alert' | string;
  alertType?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  timestamp?: number;
  contactName?: string;
  urgency?: 'critical' | 'high' | 'normal';
  organizationId?: string;
  incidentId?: string;
  workOrderId?: string;
  requestId?: string;
  event?: string;
}

export type PushDeepLinkPayload = {
  organizationId?: string;
  incidentId?: string;
  workOrderId?: string;
  requestId?: string;
  event?: string;
  type?: string;
};

/** Expo Go (SDK 53+) cannot register remote push — soft-skip instead of crashing. */
function isExpoGoClient(): boolean {
  return Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async notification => {
      const data = notification.request.content.data as unknown as Partial<NotificationData>;

      if (data?.urgency === 'critical') {
        return {
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
        };
      }

      return {
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
} catch (err) {
  console.warn('Notification handler setup skipped', err);
}

/**
 * Validate push deep-link against active org — fail closed on tenant mismatch.
 */
export function validatePushDeepLink(
  data: PushDeepLinkPayload | null | undefined,
  activeOrgId: string | null
): { ok: true; payload: PushDeepLinkPayload } | { ok: false; reason: string } {
  if (!data) return { ok: false, reason: 'empty_payload' };
  const orgId = data.organizationId ? String(data.organizationId) : null;
  if (orgId && activeOrgId && orgId !== activeOrgId) {
    return { ok: false, reason: 'organization_mismatch' };
  }
  if (
    !data.incidentId &&
    !data.workOrderId &&
    !data.requestId &&
    data.type !== 'emergency_alert'
  ) {
    return { ok: false, reason: 'missing_target' };
  }
  return { ok: true, payload: data };
}

/**
 * Foreground / background / cold-start push routing with org validation.
 */
export function setupPushDeepLinkHandlers(options: {
  getActiveOrgId: () => Promise<string | null>;
  onNavigate: (payload: PushDeepLinkPayload) => void;
}): () => void {
  const handle = async (data: PushDeepLinkPayload | undefined) => {
    const activeOrgId = await options.getActiveOrgId();
    const result = validatePushDeepLink(data, activeOrgId);
    if (!result.ok) {
      console.warn('Push deep link rejected', result.reason, data);
      return;
    }
    options.onNavigate(result.payload);
  };

  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data as PushDeepLinkPayload;
    void handle(data);
  });

  void Notifications.getLastNotificationResponseAsync().then(response => {
    if (!response) return;
    const data = response.notification.request.content.data as PushDeepLinkPayload;
    void handle(data);
  });

  return () => {
    responseSub.remove();
  };
}

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
      await this.requestNotificationPermissions();
      await this.registerForPushNotifications();
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
            allowCriticalAlerts: true,
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
      if (isExpoGoClient()) {
        console.warn('Skipping remote push token registration in Expo Go (use a development build)');
        return null;
      }

      if (!this.notificationPermission) {
        console.log('Notification permission not granted');
        return null;
      }

      const projectId = getExpoProjectId();
      if (!projectId) {
        console.warn('EAS projectId missing — cannot register Expo push token');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      this.expoPushToken = token.data;
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);

      await registerCurrentDevice(this.expoPushToken).catch(err => {
        console.warn('orgDevices registration deferred until platform bridge is ready', err);
      });

      console.log('Expo push token:', this.expoPushToken);
      return this.expoPushToken;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  public async syncOrgDeviceRegistration(): Promise<void> {
    if (!this.expoPushToken) {
      await this.registerForPushNotifications();
      return;
    }
    await registerCurrentDevice(this.expoPushToken);
  }

  private async setupNotificationCategories(): Promise<void> {
    try {
      await Notifications.setNotificationCategoryAsync('emergency_alert', [
        {
          identifier: 'respond',
          buttonTitle: 'Respond',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'call_emergency',
          buttonTitle: 'Call 10111',
          options: { opensAppToForeground: false },
        },
      ]);
      await Notifications.setNotificationCategoryAsync('work_order', [
        {
          identifier: 'open_work_order',
          buttonTitle: 'Open',
          options: { opensAppToForeground: true },
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

      const contactsData = await AsyncStorage.getItem('emergencyContacts');
      if (!contactsData) {
        console.log('No emergency contacts found');
        return 0;
      }

      const contacts: EmergencyContact[] = JSON.parse(contactsData);
      let successCount = 0;
      const senderName = userName || 'Someone';
      const locationText = location
        ? `\nLocation: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
        : '';

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
                interruptionLevel: 'critical',
                criticalAlert: {
                  name: 'emergency',
                  volume: 1.0,
                },
              }),
            },
            trigger: {
              seconds: 1 + successCount * 2,
            },
          });

          successCount++;
        } catch (error) {
          console.error(`Failed to send notification for ${contact.name}:`, error);
        }
      }

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
    data?: Record<string, unknown>
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
        trigger: null,
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

  public setupNotificationResponseHandler(): void {
    setupPushDeepLinkHandlers({
      getActiveOrgId: async () => AsyncStorage.getItem('platformActiveOrgId'),
      onNavigate: payload => {
        console.log('Push deep link', payload);
      },
    });
  }
}

export default NotificationService;
