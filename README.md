# Clikd

Clikd is a Bluetooth-connected messaging device and companion mobile app that allows two people to communicate through personalized click sequences, LED patterns, and vibrations. The app manages device pairing, a shared message library, custom patterns, and communication between paired devices.

## Tech Stack

- **React Native + Expo SDK 58** — Cross-platform iOS and Android development
- **TypeScript** — Application development
- **Expo Router** — File-based navigation
- **GitHub** — Version control and collaboration

## Getting Started

### Prerequisites

- Node.js 26 LTS
- Git
- VS Code
- Expo Go (for mobile testing)

### Installation

Clone the repository:

```bash
git clone git@github.com:nathanmy/Clikd.git
cd Clikd
```

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npx expo start
```

Scan the QR code with Expo Go to run the app on your phone, or press `w` to preview it in your browser.

**Windows PowerShell:** Use `npm.cmd` and `npx.cmd` if script execution is restricted.

## Project Structure

```text
src/
├── app/           # Screens and navigation
├── components/    # Reusable UI components
├── constants/     # Theme and constants
└── hooks/         # Reusable React hooks
```