# Safe Alert Responder App

Emergency responder application for police, armed response, and EMS personnel to receive and respond to citizen alerts.

## Features

- **Unit Setup**: Configure responder profile with Unit ID, name, role, and optional provider ID
- **Assignment List**: Real-time view of relevant alerts filtered by role and provider
- **Alert Detail**: Map view of citizen location with status progression workflow
- **Location Heartbeat**: Automatic location tracking while responding to active alerts
- **WebSocket Updates**: Live updates for new alerts and assignment status changes

## Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

## Installation

```bash
cd responder-app
npm install
```

## Configuration

Set the dispatch server URL using the environment variable:

```bash
export EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
```

Or for development on a physical device, use your machine's IP address:

```bash
export EXPO_PUBLIC_API_BASE_URL=http://192.168.1.xxx:4000
```

## Running

### Start the dispatch server first

```bash
cd ../server
node index.js
```

The server will run on http://localhost:4000

### Start the responder app

```bash
cd responder-app
npm start
```

Then press:
- `i` for iOS Simulator
- `a` for Android Emulator
- Scan QR code with Expo Go app for physical device

## Usage Flow

1. **Setup Screen**: On first launch, enter:
   - Unit ID (unique identifier for this responder)
   - Name
   - Role: police, armed_response, or ems
   - Provider ID (optional, for armed response only)

2. **Assignments Screen**: View all alerts relevant to your role
   - Pull to refresh
   - Shows alert type, status, ETA, and distance
   - Tap an alert to view details

3. **Alert Detail Screen**: 
   - Map showing citizen's location
   - Status progression buttons:
     - Pending → Accepted → En Route → On Scene → Resolved
   - Location heartbeat sends your position every 20 seconds while active

## Testing

To test the complete flow:

1. Start the dispatch server
2. Start the responder app and complete setup
3. Create a test alert using the citizen app or dispatch web interface
4. The alert should appear in the assignments list
5. Tap the alert and progress through status updates
6. Verify location heartbeat is sent to the server

## Tech Stack

- React Native (Expo)
- React Navigation
- React Native Maps
- Expo Location
- AsyncStorage
- WebSocket
