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
    device_simulator/    Input interpretation and recording lifecycle for the simulator
    library/             Codeword editor, drag reordering, shared library styles
    keycap/              Sequence definitions, LED palette, visualization, playback
    profile/             Profile/photo and feedback editors with shared styling
  hooks/                   Shared accessibility preference hooks
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
message index. Settings changes do not rewrite history. History updates prepare
new bodies and a new immutable index, sharing existing bodies by a saved prefix.
A single root write commits the index pointer and settings together; a failed
commit leaves the earlier snapshot active. Older index formats still load, and
obsolete index records are cleaned up after a successful commit. Migration retains the earlier save until the
new format commits successfully. Recovery also backs up the individual records.
Durable actions return a promise and publish updates only after saving succeeds;
callers must await their result. Errors leave drafts open for retry. Morse entries
remain fixed, and device telemetry is never restored as a real connection.
Development demo data uses a separate storage key from normal app data. Existing
library-only saves migrate automatically. All supported save formats run the
same final migration before being committed to the current format. Recovery backs up unreadable data before
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
Clickd Codes allows up to 25 codewords. Adding is disabled at capacity; editing,
deleting, and reordering remain available. Existing larger saves are preserved,
and demo migrations never add codewords beyond the limit.
The reorder icon in the CODEWORD / MEANING header enters Organize mode; the
checkmark finishes it. Rows follow the drag, neighboring rows move aside, and
holding near the list edges scrolls automatically. Keyboard and screen-reader
actions move entries up or down. Drag handles are 44 by 44; reduced motion
disables the neighboring-row springs. Reordered entries save after release.
Codeword edits allow up to 16 clicks and 120 characters of meaning; historical
messages and older library entries remain readable without truncation.
Duplicate sequences show an inline error while editing and disable saving until
resolved. The current codeword is excluded from its own duplicate check.
Playback is bounded to 64 presses. Recorded timings beyond 60 seconds total or
10 seconds per press use standard click timings for preview; the original saved
recording is retained. Longer sequences are not replayed. Circular lighting
continues its rotation between presses rather than restarting each time.
Stats' sent/received count cards also select the corresponding chart metric.

Profile supports a saved name, photo, and color theme. Theme backgrounds apply to
all four tabs, the tab bar, and editors. Older `homeBackground` values migrate to
the canonical `themeId`, whose allowed values come from the theme registry. Themes also color message
bubbles, avatars, replay buttons, and the keycap body and shell.
Library controls and Stats selectors, chart bars, and borders use the same theme
palette; content cards stay white and text stays dark for readability. Codeword lighting
and feedback colors remain independent of appearance. Native photos are copied
to document storage; browser photos use persistent image data. The profile pencil opens a draft editor; name and photo changes save together, and
Cancel asks before discarding changes. Profile shows identity, Appearance, and Device feedback; unused Privacy and
Notifications placeholders are hidden. Appearance uses an equal two-column grid
with a miniature keycap and message bubbles rendered in each option's own palette. Device feedback has editable colors: Ready to send controls
the idle glow on all keycaps, and Message sent stores the confirmation color for
future device integration. Defaults are idle white and green, respectively.
The sent-color editor pulses only its preview LEDs, pausing in the background and
respecting reduced-motion preferences. Keycap artwork is memoized independently
of playback frames. Home places the battery beneath the left keycap, and message
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

Generated demo messages receive only the explicit, one-time fixture corrections
in `demo_data.ts`. Normal message snapshots, and corrected demo snapshots after
later library edits, retain their original meaning, symbols, colors, and feedback.

Vibration settings include enabled/disabled and strength. The editor no longer
offers a duration multiplier; recorded press timing and lighting playback are
unchanged. Older saved messages remain readable with their original snapshots.
Keycap artwork and its platform shadow share a square SVG coordinate system in
Home and editors.

Home distinguishes older history from new arrivals: backfilled messages do not
increase the new-message indicator or force a scroll to the latest message.
Native lists also retain the visible message when history is prepended. Home,
reordering, and feedback previews share the system reduced-motion preference.
Fresh demo fixtures are generated directly in the current format; historical
fixture corrections run only while restoring older saved examples.

## Device Simulator

In development builds, open Profile, then Developer tools > Device simulator.
It opens as a separate full-screen route above the existing tabs. Release builds
hide the entry and redirect direct simulator navigation back to Profile unless
the build explicitly enables the shared demo preview.
Press the keycap itself, then release to record each press. The cap depresses
inside its fixed platform while held. The screen keeps only the sequence, match,
and essential action controls visible. Initial
simulator settings classify holds of at least 400 ms as dashes. Clickd input
automatically receives the codeword after a 900 ms pause.
Morse sends one word at a time: pauses under 900 ms continue the same letter,
pauses from 900 ms to under 2,000 ms separate letters, and a 2,000 ms pause
automatically receives the word. Each pause is measured from the last
release; a new press cancels the receive timer. These are development settings,
not final firmware rules.
The simulator resolves recordings against the active library, previews a matched
codeword, and automatically adds a received test message to the current conversation.
Replay it from Home to see its recorded glow. Test messages stay in memory for
the current app session and disappear on reload or restart. Older saved simulator
messages are removed at startup; ordinary message history is preserved.
Messages retain the captured library metadata, meaning, feedback, and press
recording. Unknown sequences cannot be received. A linked partner and conversation
are required; development demo data supplies both. Morse words support up to
64 presses and 60 seconds of recorded input, retaining pauses for replay. Invalid
Morse characters block receiving and show an error. Bluetooth is future work.
Incomplete recording stops when leaving the screen or backgrounding the app.
Live dot/dash feedback and a pause progress bar show the current input stage;
How to use expands the timing rules. A completed message stays visible and can
be previewed until the next recording or Clear. Preview is disabled during input
so a previous recording cannot be mistaken for the current one. Late timers do
not merge words across a receive timeout. Morse letter boundaries are shown with
slashes in simulator input, message bubbles, and top-codeword statistics without
changing the original saved symbols or replay timings.

## Share a Web Demo

Publish a separate demo preview with Expo Hosting. In PowerShell, from the project folder:

```powershell
npx.cmd eas-cli@latest login
$env:EXPO_PUBLIC_DEMO_PREVIEW = "true"
npx.cmd expo export --platform web
npx.cmd eas-cli@latest deploy
Remove-Item Env:EXPO_PUBLIC_DEMO_PREVIEW
```

On the first deployment, follow the prompts to link your Expo project and choose
a preview subdomain. Share the preview URL printed after deployment.
The opt-in export includes demo messages and the device simulator without requiring
a development server. Each browser keeps its own local data; coworkers do not
exchange messages. The demo flag is public build configuration, not a secret.
Normal exports without the flag keep the simulator and seeded demo data disabled.
Re-export before deploying changes. Keep the preview flag enabled for that export,
then remove it from your shell afterward.

The simulator displays its selected library above the keycap. Interrupted gestures
cancel the draft rather than becoming clicks. Recording and timer management live
in `features/device_simulator/use_device_simulator.ts`; visible instructions use
the same timing constants as interpretation. Fresh demo histories use recent
timestamps, while previously saved message timestamps are preserved.
