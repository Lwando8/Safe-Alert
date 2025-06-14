# Safe Alert - Emergency SOS App

🚨 A comprehensive emergency response mobile application built with React Native and Expo, designed to provide quick access to emergency services and keep users safe.

## Features

### 🏠 **Home Screen**
- Real-time clock and date display
- Personalized greetings based on time of day
- Quick emergency button with location status
- Four quick action buttons for emergency services

### 🚨 **Emergency Alert System**
- **Main SOS Button**: Sends emergency alerts to all contacts and services
- **Hospital Alert**: Dedicated medical emergency button for ambulance services
- **Armed Response**: Security emergency button for police/security assistance
- 5-second countdown with cancel option for accidental triggers
- Vibration feedback for urgent situations

### 🎯 **Key Features**
- **Location Services**: Real-time GPS tracking and location sharing
- **Emergency Contacts**: Quick access to emergency contact management
- **User Profile**: Personal and medical information storage
- **Community Features**: Connect with local safety community
- **Contact Management**: Comprehensive emergency contact system

### 📱 **Navigation**
- **Home**: Overview and quick actions
- **Community**: Local safety network
- **Alert**: Main emergency response center
- **Contacts**: Emergency contact management
- **Profile**: User settings and information

## Tech Stack

- **Framework**: React Native with Expo SDK 53
- **Navigation**: React Navigation 6
- **UI Components**: React Native Elements with Ionicons
- **State Management**: React Context API
- **Storage**: AsyncStorage for persistent data
- **Location**: Expo Location services
- **Notifications**: Expo Notifications
- **Communication**: Expo SMS integration

## Installation

### Prerequisites
- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Setup
1. Clone the repository:
```bash
git clone https://github.com/Lwando8/Safe-Alert.git
cd Safe-Alert
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npx expo start
```

4. Run on device:
   - Scan QR code with Expo Go app
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Application screens
│   ├── main/          # Main app screens
│   └── auth/          # Authentication screens
├── context/           # React Context providers
├── theme/             # Theme configuration and colors
├── services/          # Business logic and API services
├── navigation/        # Navigation configuration
└── types/             # TypeScript type definitions
```

## Key Components

### Emergency Alert System
- **SOS Button**: Large, prominent emergency button with countdown
- **Secondary Alerts**: Hospital and Armed Response buttons
- **Location Integration**: Automatic location sharing with emergency services
- **Contact Notifications**: SMS and call integration for emergency contacts

### Safety Features
- **Quick Actions**: Fast access to emergency services
- **Location Status**: Real-time GPS tracking indicator
- **Emergency Instructions**: Clear guidance for different emergency types
- **Medical Information**: Stored medical data for first responders

## Development

### Available Scripts
- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser

### Code Quality
- TypeScript for type safety
- ESLint for code linting
- Prettier for code formatting

## Safety & Privacy

- **Location Privacy**: Location data is only shared during active emergencies
- **Secure Storage**: Personal and medical information encrypted locally
- **Emergency Only**: Contact sharing limited to emergency situations
- **User Control**: Full control over information sharing and emergency contacts

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Emergency Services Integration

This app is designed to work with:
- Local emergency services (911, 112, etc.)
- Medical emergency services
- Police and security services
- Personal emergency contacts

**Note**: This app is designed to complement, not replace, traditional emergency services. Always call your local emergency number (911, 112, etc.) in life-threatening situations.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue on GitHub or contact the development team.

## Roadmap

- [ ] Real-time emergency service integration
- [ ] Voice-activated emergency alerts
- [ ] Wearable device integration
- [ ] Multi-language support
- [ ] Offline emergency capabilities
- [ ] Emergency service tracking and status updates

---

**⚠️ Important**: This is an emergency response application. Please ensure proper testing before deployment and compliance with local emergency service regulations.

Built with ❤️ for user safety and peace of mind.
