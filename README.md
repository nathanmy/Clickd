# Clickd

Clickd is a Bluetooth-connected messaging device and companion mobile application that enables two people to communicate through personalized click sequences, LED patterns, and vibrations.

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
git clone git@github.com:nathanmy/Clikd.git Clickd
cd Clickd
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
    storage.ts           Local persistence, legacy migration, and recovery backups
    stats.ts             Calendar periods, message metrics, rankings, and streaks
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
Clickd codewords, library selection, message snapshots, profiles, conversation
information, history coverage, and the selected color theme are restored using AsyncStorage.
Version 2 stores settings separately from individually saved message bodies and a
message index. Settings changes do not rewrite history; new messages write their
body before committing the index. Migration retains the earlier save until the
new format commits successfully. Recovery also backs up the individual records.
Durable actions return a promise and publish updates only after saving succeeds;
callers must await their result. Errors leave drafts open for retry. Morse entries
remain fixed, and device telemetry is never restored as a real connection.
Development demo data uses a separate storage key from normal app data. Existing
library-only saves migrate automatically. Recovery backs up unreadable data before
replacing it with defaults, and never resets data if the backup fails.
Settings updates accept only changed fields and merge inside the save queue.
Startup distinguishes development-data errors, unavailable storage, and invalid
saved data; reset is offered only for the last case.

Stats calculates values for Home's current
conversation. Periods before recorded history are marked incomplete, with unavailable dates
and averages shown accordingly. Partial periods show averages since tracking began,
excluding earlier backfilled messages from the average. The first recorded day or
month counts as one bucket, including when recording began partway through it.
Message clicks count presses in sent messages;
total device clicks and fidget time are hidden until device activity is implemented.
The current streak uses recorded local-calendar days independently of the chart period.
Week and Month use daily averages; Year uses a monthly average. Average lines are
always visible when enough history exists to calculate them.
The arrows beside the period label change weeks, months, or years. Tap a chart
bar to inspect its date and count; native screen readers can adjust the selected date.
On web, focus the chart and use the left/right arrow keys.

The codeword editor previews lighting with the same keycap and playback logic as
Home. Physical vibration and previews on the Clickd device require hardware integration.
Playback stops when the app moves into the background. Saving an unchanged
codeword leaves its library revision unchanged and skips the storage write.
Closing a changed codeword draft asks before discarding it.
Codeword edits allow up to 16 clicks and 120 characters of meaning; historical
messages and older library entries remain readable without truncation.
Duplicate sequences show an inline error while editing and disable saving until
resolved. The current codeword is excluded from its own duplicate check.
Playback is bounded to 64 presses. Recorded timings beyond 60 seconds total or
10 seconds per press use standard click timings for preview; the original saved
recording is retained. Longer sequences are not replayed.
Stats' sent/received count cards also select the corresponding chart metric.

Profile supports a saved name, photo, and color theme. Theme backgrounds apply to
all four tabs, the tab bar, and editors. Older `homeBackground` values migrate to
the canonical `themeId`, whose allowed values come from the theme registry. Themes also color message
bubbles, avatars, replay buttons, and the keycap body and shell.
Library controls and Stats selectors, chart bars, and borders use the same theme
palette; content cards stay white and text stays dark for readability. Codeword lighting
and feedback colors remain independent of appearance. Native photos are copied
to document storage; browser photos use persistent image data. The pencil and
camera controls open a draft editor; name and photo changes save together, and
Cancel asks before discarding changes. Privacy and Notifications remain visible as
unavailable settings. Device feedback has editable colors: Ready to send controls
the idle glow on all keycaps, and Message sent stores the confirmation color for
future device integration. Defaults are idle white and green, respectively.
The sent-color editor pulses only its preview LEDs, pausing in the background and
respecting reduced-motion preferences. Keycap artwork is memoized independently
of playback frames. Home places the battery beneath Your device, and message
avatars fall back to their placeholder if a photo cannot load.
Selected photos are
cropped square and resized to at most 512 pixels, then compressed as JPEG.
The Home heart respects the system's reduced-motion preference. Photo picking uses
`expo-image-picker`, `expo-image-manipulator`, and `expo-file-system`.
Native builds need rebuilding after
adding these modules. Bluetooth pairing, accounts, and device feedback remain future work.

The repository includes the keycap illustration and tab icons. Custom launcher
icons, favicon, and splash artwork are not supplied; Expo defaults are used until
real assets are added to `app.json`.
