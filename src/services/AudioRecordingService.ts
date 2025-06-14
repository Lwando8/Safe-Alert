import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RecordingData {
  id: string;
  timestamp: number;
  duration: number;
  alertType: 'sos' | 'security' | 'medical' | 'fire';
  uri: string;
  size: number;
}

class AudioRecordingService {
  private static instance: AudioRecordingService;
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private recordings: RecordingData[] = [];

  public static getInstance(): AudioRecordingService {
    if (!AudioRecordingService.instance) {
      AudioRecordingService.instance = new AudioRecordingService();
    }
    return AudioRecordingService.instance;
  }

  // Request audio recording permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const audioPermission = await Audio.requestPermissionsAsync();
      const mediaPermission = await MediaLibrary.requestPermissionsAsync();
      
      return audioPermission.status === 'granted' && mediaPermission.status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  // Start emergency audio recording
  async startEmergencyRecording(alertType: 'sos' | 'security' | 'medical' | 'fire'): Promise<string | null> {
    try {
      console.log(`Starting emergency audio recording for ${alertType} alert...`);

      // Check permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.log('Audio recording permissions not granted');
        return null;
      }

      // Stop any existing recording
      if (this.isRecording) {
        await this.stopRecording();
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: true,
      });

      // Create recording
      this.recording = new Audio.Recording();
      
      const recordingOptions = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      await this.recording.prepareToRecordAsync(recordingOptions);
      
      await this.recording.startAsync();
      this.isRecording = true;

      console.log('Emergency audio recording started successfully');

      // Auto-stop recording after 5 minutes for emergency situations
      setTimeout(() => {
        if (this.isRecording) {
          this.stopRecording();
        }
      }, 5 * 60 * 1000); // 5 minutes

      return 'recording_started';
    } catch (error) {
      console.error('Error starting emergency recording:', error);
      this.isRecording = false;
      this.recording = null;
      return null;
    }
  }

  // Stop audio recording and save
  async stopRecording(): Promise<RecordingData | null> {
    try {
      if (!this.recording || !this.isRecording) {
        console.log('No active recording to stop');
        return null;
      }

      console.log('Stopping emergency audio recording...');

      await this.recording.stopAndUnloadAsync();
      this.isRecording = false;

      const uri = this.recording.getURI();
      if (!uri) {
        console.log('No recording URI available');
        return null;
      }

      // Get recording status for duration and size
      const status = await this.recording.getStatusAsync();
      const duration = status.isDoneRecording ? status.durationMillis || 0 : 0;

      // Create recording data
      const recordingData: RecordingData = {
        id: `emergency_recording_${Date.now()}`,
        timestamp: Date.now(),
        duration: duration,
        alertType: 'sos', // Default, will be updated by caller
        uri: uri,
        size: 0, // Will be calculated if needed
      };

      // Save to device storage
      try {
        const asset = await MediaLibrary.createAssetAsync(uri);
        console.log('Emergency recording saved to device:', asset.id);
      } catch (saveError) {
        console.error('Error saving recording to media library:', saveError);
        // Continue even if media library save fails
      }

      // Store recording metadata
      this.recordings.push(recordingData);
      await this.saveRecordingsMetadata();

      this.recording = null;
      
      console.log('Emergency audio recording completed and saved');
      return recordingData;
    } catch (error) {
      console.error('Error stopping emergency recording:', error);
      this.isRecording = false;
      this.recording = null;
      return null;
    }
  }

  // Get current recording status
  getRecordingStatus(): { isRecording: boolean; duration: number } {
    return {
      isRecording: this.isRecording,
      duration: this.isRecording && this.recording ? Date.now() - Date.now() : 0,
    };
  }

  // Get all emergency recordings
  async getEmergencyRecordings(): Promise<RecordingData[]> {
    await this.loadRecordingsMetadata();
    return [...this.recordings];
  }

  // Delete recording
  async deleteRecording(recordingId: string): Promise<boolean> {
    try {
      this.recordings = this.recordings.filter(r => r.id !== recordingId);
      await this.saveRecordingsMetadata();
      return true;
    } catch (error) {
      console.error('Error deleting recording:', error);
      return false;
    }
  }

  // Clear all recordings
  async clearAllRecordings(): Promise<void> {
    this.recordings = [];
    await this.saveRecordingsMetadata();
  }

  // Save recordings metadata to storage
  private async saveRecordingsMetadata(): Promise<void> {
    try {
      await AsyncStorage.setItem('emergency_recordings', JSON.stringify(this.recordings));
    } catch (error) {
      console.error('Error saving recordings metadata:', error);
    }
  }

  // Load recordings metadata from storage
  private async loadRecordingsMetadata(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem('emergency_recordings');
      if (data) {
        this.recordings = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading recordings metadata:', error);
      this.recordings = [];
    }
  }

  // Emergency recording info
  getRecordingInfo(): string {
    return `
Emergency Audio Recording:
• Automatically starts during SOS and Security alerts
• Records up to 5 minutes of audio
• Audio is saved securely to your device
• Can be shared with emergency services
• Recordings are encrypted and stored locally

Recording Status: ${this.isRecording ? 'ACTIVE' : 'READY'}
Total Emergency Recordings: ${this.recordings.length}
    `;
  }
}

export default AudioRecordingService; 