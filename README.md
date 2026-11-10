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

## Verification

Check the app's TypeScript:

```bash
npm run typecheck
```

Native layout, navigation lifecycle, and Bluetooth behavior still require device testing.

## Project Structure

```text
src/
  app/                   Expo Router routes and navigation
  constants/theme.ts     Application colors and spacing
  features/
    home/                Home screen, message rows, scroll behavior
    keycap/              Sequence definitions, LED palette, visualization, playback
  state/
    app_data.tsx         React contexts, public actions, consumer hooks
    types.ts             Application data contracts
    model.ts             Startup validation, message ordering, state transitions
    validation.ts        Validate and copy incoming data
    storage.ts           Local saving and restoration of library settings
    defaults.ts          Empty startup and product codewords
    demo_data.ts         Development-only example content
```

Sequence definitions are independent of React. State stores data and validates updates;
feature modules handle presentation and playback. Messages retain their own content
and feedback settings so library changes cannot rewrite history. There is one
linked partner, or none. Unlinking preserves the existing message history.

## Development Data and Assets

`src/app/_layout.tsx` enables demo data in development through `ENABLE_DEMO_DATA`.
Set it to `false` to test a disconnected device with no partner or messages.
Saved Clikd codewords (including lighting and vibration settings) and the selected
library are restored on startup using AsyncStorage. Save Changes waits for the
device to finish saving; errors leave the editor open so you can retry. Morse
entries remain fixed. Message history, profiles, and device connection state are
still session-only; development demo messages are recreated on startup.

The codeword editor previews lighting with the same keycap and playback logic as
Home. Physical vibration and previews on the Clikd device require hardware integration.

The repository includes the keycap illustration and tab icons. Custom launcher
icons, favicon, and splash artwork are not supplied; Expo defaults are used until
real assets are added to `app.json`.
