import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Vibration } from 'react-native';

// Configure notifications for critical alerts (local only — remote push needs a dev client)
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (err) {
  console.warn('EmergencyService notification handler setup skipped', err);
}

interface PoliceUnit {
  id: string;
  badge: string;
  name: string;
  vehicle: string;
  latitude: number;
  longitude: number;
  distance: number;
  status: 'available' | 'responding' | 'busy';
  eta: number; // minutes
}

interface EmergencyAlert {
  id: string;
  type: 'medical' | 'fire' | 'police' | 'security';
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  userId: string;
  status: 'sent' | 'acknowledged' | 'responding' | 'arrived' | 'resolved';
  assignedUnit?: PoliceUnit;
  responseTime?: number; // milliseconds
  arrivalTime?: number; // milliseconds
  resolutionTime?: number; // milliseconds
}

interface EmergencyLog {
  alerts: EmergencyAlert[];
  averageResponseTime: number;
  totalAlerts: number;
  responseStats: {
    under5min: number;
    under10min: number;
    over10min: number;
  };
}

class EmergencyService {
  private static instance: EmergencyService;
  private emergencyLogs: EmergencyLog = {
    alerts: [],
    averageResponseTime: 0,
    totalAlerts: 0,
    responseStats: {
      under5min: 0,
      under10min: 0,
      over10min: 0,
    },
  };

  public static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  constructor() {
    this.loadEmergencyLogs();
    this.setupNotificationPermissions();
  }

  private async setupNotificationPermissions() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true, // Critical alerts bypass silent mode
          },
          android: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Notification permissions not granted');
      }
    } catch (error) {
      console.error('Error setting up notifications:', error);
    }
  }

  // Send critical alert that bypasses silent mode
  async sendCriticalAlert(
    title: string,
    body: string,
    data?: any,
    sound: boolean = true
  ): Promise<string> {
    try {
      // Long vibration pattern for emergency
      Vibration.vibrate([0, 1000, 500, 1000, 500, 1000]);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: sound ? 'default' : false,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: 'emergency',
          interruptionLevel: 'critical', // iOS critical level
        },
        trigger: null, // Send immediately
      });

      return notificationId;
    } catch (error) {
      console.error('Error sending critical alert:', error);
      throw error;
    }
  }

  // Simulate finding nearest police units (in production, this would integrate with dispatch systems)
  private async findNearestPoliceUnits(
    latitude: number,
    longitude: number
  ): Promise<PoliceUnit[]> {
    // Simulated police units around Johannesburg area
    const simulatedUnits: PoliceUnit[] = [
      {
        id: 'unit_001',
        badge: 'JMPD-7841',
        name: 'Officer Sarah Johnson',
        vehicle: 'Patrol Car Alpha-7',
        latitude: latitude + 0.002,
        longitude: longitude + 0.001,
        distance: 0.5,
        status: 'available',
        eta: 3,
      },
      {
        id: 'unit_002',
        badge: 'SAPS-2194',
        name: 'Constable Mike Wilson',
        vehicle: 'Patrol Car Bravo-2',
        latitude: latitude - 0.001,
        longitude: longitude + 0.003,
        distance: 0.8,
        status: 'available',
        eta: 5,
      },
      {
        id: 'unit_003',
        badge: 'JMPD-5672',
        name: 'Sergeant Lisa Brown',
        vehicle: 'Patrol Car Charlie-5',
        latitude: latitude + 0.004,
        longitude: longitude - 0.002,
        distance: 1.2,
        status: 'responding',
        eta: 7,
      },
    ];

    // Filter available units and sort by distance
    return simulatedUnits
      .filter(unit => unit.status === 'available')
      .sort((a, b) => a.distance - b.distance);
  }

  // Send SOS alert to nearest police unit
  async sendSOSAlert(
    userLocation: { latitude: number; longitude: number },
    emergency: string = 'General Emergency'
  ): Promise<EmergencyAlert> {
    try {
      const alertId = `sos_${Date.now()}`;
      const timestamp = Date.now();

      // Get user data
      const userData = await AsyncStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : { fullName: 'Unknown User' };

      // Find nearest police units
      const nearestUnits = await this.findNearestPoliceUnits(
        userLocation.latitude,
        userLocation.longitude
      );

      if (nearestUnits.length === 0) {
        throw new Error('No available police units found');
      }

      const assignedUnit = nearestUnits[0];

      // Create emergency alert record
      const emergencyAlert: EmergencyAlert = {
        id: alertId,
        type: 'police',
        timestamp,
        location: userLocation,
        userId: user.fullName,
        status: 'sent',
        assignedUnit,
      };

      // Send critical notification to emergency contacts
      await this.sendCriticalAlert(
        '🚨 EMERGENCY SOS ALERT',
        `${user.fullName} has triggered an SOS alert. Police unit ${assignedUnit.badge} dispatched. ETA: ${assignedUnit.eta} minutes.`,
        {
          type: 'sos',
          alertId,
          location: userLocation,
          assignedUnit: assignedUnit.badge,
        }
      );

      // Log the alert
      this.emergencyLogs.alerts.push(emergencyAlert);
      this.emergencyLogs.totalAlerts++;
      await this.saveEmergencyLogs();

      // Simulate police unit acknowledgment (in production, this would come from dispatch system)
      setTimeout(() => {
        this.updateAlertStatus(alertId, 'acknowledged');
        this.sendCriticalAlert(
          'Police Response Update',
          `Unit ${assignedUnit.badge} has acknowledged your SOS alert and is en route.`
        );
      }, 2000);

      // Simulate police unit arriving (based on ETA)
      setTimeout(() => {
        this.updateAlertStatus(alertId, 'arrived');
        this.sendCriticalAlert(
          'Police Unit Arrived',
          `Unit ${assignedUnit.badge} has arrived at your location.`
        );
      }, assignedUnit.eta * 60 * 1000); // Convert minutes to milliseconds

      return emergencyAlert;
    } catch (error) {
      console.error('Error sending SOS alert:', error);
      throw error;
    }
  }

  // Update alert status and track response times
  async updateAlertStatus(
    alertId: string,
    status: EmergencyAlert['status']
  ): Promise<void> {
    try {
      const alertIndex = this.emergencyLogs.alerts.findIndex(
        alert => alert.id === alertId
      );

      if (alertIndex === -1) {
        console.warn(`Alert ${alertId} not found`);
        return;
      }

      const alert = this.emergencyLogs.alerts[alertIndex];
      const currentTime = Date.now();

      // Update status
      alert.status = status;

      // Track response times
      switch (status) {
        case 'acknowledged':
          alert.responseTime = currentTime - alert.timestamp;
          break;
        case 'arrived':
          alert.arrivalTime = currentTime - alert.timestamp;
          this.updateResponseStats(alert.arrivalTime);
          break;
        case 'resolved':
          alert.resolutionTime = currentTime - alert.timestamp;
          break;
      }

      // Update logs
      this.emergencyLogs.alerts[alertIndex] = alert;
      await this.saveEmergencyLogs();

      console.log(`Alert ${alertId} status updated to: ${status}`);
    } catch (error) {
      console.error('Error updating alert status:', error);
    }
  }

  // Update response time statistics
  private updateResponseStats(arrivalTime: number): void {
    const arrivalMinutes = arrivalTime / (1000 * 60);

    if (arrivalMinutes < 5) {
      this.emergencyLogs.responseStats.under5min++;
    } else if (arrivalMinutes < 10) {
      this.emergencyLogs.responseStats.under10min++;
    } else {
      this.emergencyLogs.responseStats.over10min++;
    }

    // Calculate average response time
    const totalResponseTimes = this.emergencyLogs.alerts
      .filter(alert => alert.arrivalTime)
      .reduce((sum, alert) => sum + (alert.arrivalTime || 0), 0);

    const respondedAlerts = this.emergencyLogs.alerts.filter(
      alert => alert.arrivalTime
    ).length;

    if (respondedAlerts > 0) {
      this.emergencyLogs.averageResponseTime = totalResponseTimes / respondedAlerts;
    }
  }

  // Get emergency logs for police monitoring
  getEmergencyLogs(): EmergencyLog {
    return this.emergencyLogs;
  }

  // Get active alerts
  getActiveAlerts(): EmergencyAlert[] {
    return this.emergencyLogs.alerts.filter(
      alert => !['resolved', 'cancelled'].includes(alert.status)
    );
  }

  // Save logs to storage
  private async saveEmergencyLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        'emergencyLogs',
        JSON.stringify(this.emergencyLogs)
      );
    } catch (error) {
      console.error('Error saving emergency logs:', error);
    }
  }

  // Load logs from storage
  private async loadEmergencyLogs(): Promise<void> {
    try {
      const savedLogs = await AsyncStorage.getItem('emergencyLogs');
      if (savedLogs) {
        this.emergencyLogs = JSON.parse(savedLogs);
      }
    } catch (error) {
      console.error('Error loading emergency logs:', error);
    }
  }

  // Send emergency alert to contacts with critical priority
  async sendEmergencyContactAlert(
    contacts: any[],
    alertType: string,
    userLocation: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      const userData = await AsyncStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : { fullName: 'Emergency Contact' };

      // Send critical notification
      await this.sendCriticalAlert(
        `🚨 EMERGENCY: ${alertType.toUpperCase()}`,
        `${user.fullName} needs immediate assistance. Location: ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`,
        {
          type: 'emergency_contact',
          alertType,
          location: userLocation,
          timestamp: Date.now(),
        }
      );

      console.log(`Emergency contact alert sent for ${alertType}`);
    } catch (error) {
      console.error('Error sending emergency contact alert:', error);
    }
  }

  // Generate emergency report for authorities
  generateEmergencyReport(): string {
    const logs = this.emergencyLogs;
    const avgResponseMinutes = logs.averageResponseTime / (1000 * 60);

    return `
=== EMERGENCY RESPONSE REPORT ===
Total Alerts: ${logs.totalAlerts}
Average Response Time: ${avgResponseMinutes.toFixed(2)} minutes

Response Time Distribution:
- Under 5 minutes: ${logs.responseStats.under5min} alerts
- 5-10 minutes: ${logs.responseStats.under10min} alerts  
- Over 10 minutes: ${logs.responseStats.over10min} alerts

Recent Alerts:
${logs.alerts.slice(-5).map(alert => 
  `- ${new Date(alert.timestamp).toLocaleString()}: ${alert.type.toUpperCase()} - Status: ${alert.status}${alert.assignedUnit ? ` (Unit: ${alert.assignedUnit.badge})` : ''}`
).join('\n')}
    `;
  }
}

export default EmergencyService;