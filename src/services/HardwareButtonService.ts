import { Alert, BackHandler, Vibration } from 'react-native';
import { useCallback, useEffect, useRef } from 'react';

interface ButtonPress {
  timestamp: number;
  button: 'power' | 'volume_up' | 'volume_down' | 'back';
}

class HardwareButtonService {
  private static instance: HardwareButtonService;
  private buttonPresses: ButtonPress[] = [];
  private emergencyCallback?: () => void;
  private directSOSCallback?: () => void;
  private isListening = false;
  private emergencyTimeout?: NodeJS.Timeout;
  private backHandlerSubscription?: any;

  public static getInstance(): HardwareButtonService {
    if (!HardwareButtonService.instance) {
      HardwareButtonService.instance = new HardwareButtonService();
    }
    return HardwareButtonService.instance;
  }

  // Set callback function to execute when emergency button combination is detected
  setEmergencyCallback(callback: () => void): void {
    this.emergencyCallback = callback;
  }

  // Set callback function for direct SOS (bypasses confirmation)
  setDirectSOSCallback(callback: () => void): void {
    this.directSOSCallback = callback;
  }

  // Start listening for hardware button combinations
  startListening(): void {
    if (this.isListening) return;
    
    this.isListening = true;
    
    // Listen for back button as a simulation of hardware button detection
    // Note: React Native limitations prevent direct power + volume button detection
    this.backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', this.handleBackPress);
    
    console.log('Hardware button monitoring started (Power + Volume Down simulation)');
  }

  // Stop listening for hardware button combinations
  stopListening(): void {
    if (!this.isListening) return;
    
    this.isListening = false;
    
    if (this.backHandlerSubscription) {
      this.backHandlerSubscription.remove();
      this.backHandlerSubscription = null;
    }
    
    if (this.emergencyTimeout) {
      clearTimeout(this.emergencyTimeout);
    }
    
    console.log('Hardware button monitoring stopped');
  }

  private handleBackPress = (): boolean => {
    // Simulate power + volume down detection using back button
    // In production, this would require native modules for true hardware detection
    this.recordButtonPress('power'); // Simulate power button
    this.recordButtonPress('volume_down'); // Simulate volume down
    return false; // Let the system handle the back press normally
  };

  // Record button press and check for emergency pattern
  private recordButtonPress(button: 'power' | 'volume_up' | 'volume_down' | 'back'): void {
    const now = Date.now();
    
    // Add current press
    this.buttonPresses.push({
      timestamp: now,
      button,
    });

    // Keep only recent presses (last 2 seconds for power + volume combination)
    this.buttonPresses = this.buttonPresses.filter(
      press => now - press.timestamp < 2000
    );

    // Check for emergency pattern (power + volume down within 1 second)
    this.checkEmergencyPattern();
  }

  // Check if button presses match emergency pattern (Power + Volume Down)
  private checkEmergencyPattern(): void {
    const now = Date.now();
    const recentPresses = this.buttonPresses.filter(
      press => now - press.timestamp < 1000
    );

    // Emergency pattern: Power + Volume Down pressed together (within 1 second)
    const hasPower = recentPresses.some(press => press.button === 'power');
    const hasVolumeDown = recentPresses.some(press => press.button === 'volume_down');

    if (hasPower && hasVolumeDown && recentPresses.length >= 2) {
      this.triggerEmergencyAccess();
      // Clear recorded presses to prevent multiple triggers
      this.buttonPresses = [];
    }
  }

  // Trigger emergency access
  private triggerEmergencyAccess(): void {
    console.log('Emergency button combination detected! (Power + Volume Down)');
    
    // Emergency vibration pattern - longer for power + volume combination
    Vibration.vibrate([0, 1000, 300, 1000, 300, 1000]);
    
    // Use direct SOS callback if available (bypasses confirmation)
    if (this.directSOSCallback) {
      console.log('Triggering direct SOS via hardware buttons...');
      this.directSOSCallback();
    } else if (this.emergencyCallback) {
      // Fallback to regular emergency callback
      this.emergencyCallback();
    } else {
      Alert.alert(
        'Emergency Access',
        'Power + Volume Down combination detected! Emergency mode activated.',
        [
          { text: 'OK' }
        ]
      );
    }
  }

  // Simulate power + volume down emergency combination (for testing)
  simulateEmergencyPattern(): void {
    console.log('Simulating Power + Volume Down emergency combination...');
    
    Alert.alert(
      'Hardware Button Simulation',
      'This simulates pressing Power + Volume Down buttons together for emergency access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger Emergency',
          style: 'destructive',
          onPress: () => this.triggerEmergencyAccess()
        }
      ]
    );
  }

  // Get current button press history (for debugging)
  getButtonHistory(): ButtonPress[] {
    return [...this.buttonPresses];
  }

  // Get information about hardware button limitations
  getHardwareInfo(): string {
    return `
Emergency Hardware Shortcut: Power + Volume Down

IMPORTANT NOTES:
• React Native has limitations for detecting physical button combinations
• This implementation uses back button as simulation for testing
• Production apps require native modules for true power + volume detection
• The emergency shortcut follows standard emergency access patterns used by:
  - iPhone Emergency SOS (side button + volume)
  - Android Emergency Mode (power + volume down)
  - Emergency services recommendations

Current Implementation:
• Back button press simulates Power + Volume Down
• Use "Test Hardware Button" for demonstration
• Emergency vibration pattern activates on detection
    `;
  }
}

// React hook for using hardware button service
export const useHardwareButtons = (onEmergencyTrigger: () => void, onDirectSOS?: () => void) => {
  const serviceRef = useRef<HardwareButtonService | null>(null);

  useEffect(() => {
    serviceRef.current = HardwareButtonService.getInstance();
    serviceRef.current.setEmergencyCallback(onEmergencyTrigger);
    
    // Set direct SOS callback if provided
    if (onDirectSOS) {
      serviceRef.current.setDirectSOSCallback(onDirectSOS);
    }
    
    serviceRef.current.startListening();

    return () => {
      serviceRef.current?.stopListening();
    };
  }, [onEmergencyTrigger, onDirectSOS]);

  const simulateEmergency = useCallback(() => {
    serviceRef.current?.simulateEmergencyPattern();
  }, []);

  const getHardwareInfo = useCallback(() => {
    return serviceRef.current?.getHardwareInfo() || '';
  }, []);

  return {
    simulateEmergency,
    getHardwareInfo,
    service: serviceRef.current,
  };
};

export default HardwareButtonService; 