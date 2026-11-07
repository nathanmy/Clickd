# Clikd

Clikd is a Bluetooth-connected messaging device and companion mobile application that enables two people to communicate through personalized click sequences, LED patterns, and vibrations.

The mobile app will support device pairing, a shared message library, customizable patterns, and communication between paired devices.

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
- Expo Go (for initial mobile testing)

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

**Note:** Native Bluetooth functionality will require an Expo development build rather than Expo Go.

## Project Structure

```text
Clikd/
├── src/
│   ├── app/
│   │   ├── _layout.tsx          # Root navigation
│   │   └── (tabs)/
│   │       ├── _layout.tsx      # Bottom tab navigation
│   │       ├── index.tsx        # Home screen
│   │       └── library.tsx      # Code Library screen
│   ├── components/              # Reusable UI components
│   └── constants/
│       └── theme.ts            # Shared colors and spacing
├── assets/                      # Images and icons
├── app.json                     # Expo configuration
├── package.json                 # Dependencies and scripts
├── package-lock.json            # Locked dependency versions
└── tsconfig.json                # TypeScript configuration
```