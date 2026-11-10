import { Stack } from 'expo-router';

import { AppDataProvider } from '@/state/app_data';
import { createDefaultState } from '@/state/defaults';
import { createDemoState } from '@/state/demo_data';

// Explicit development switch. Set false to test a normal empty startup.
const ENABLE_DEMO_DATA = true;

const initialState =
  __DEV__ && ENABLE_DEMO_DATA
    ? createDemoState()
    : createDefaultState();

export default function RootLayout() {
  return (
    <AppDataProvider initialState={initialState}>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
    </AppDataProvider>
  );
}
