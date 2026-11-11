import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialize } from './model';
import { refreshDemoExamples } from './demo_data';
import type {
  AppDataState,
  CodeLibrary,
  Message,
  SharedAppData,
} from './types';

// Keep the original storage namespace and library IDs so existing saves remain readable.
const LEGACY_KEY = '@clikd/library-settings-v1';
type Source = SharedAppData['history']['source'];
const rootKey = (source: Source) => `@clikd/app-v2/${source}`;
const oldKey = (source: Source) => `@clikd/app-v1/${source}`;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const locations = new Map<
  Source,
  { indexKey: string; messagePrefix: string; ids: ReadonlySet<string> }
>();
const messageKey = (index: string, id: string) =>
  `${index}/message/${encodeURIComponent(id)}`;

export class AppLoadError extends Error {
  constructor(
    public readonly kind: 'seed' | 'storage' | 'saved',
    message: string,
  ) {
    super(message);
    this.name = 'AppLoadError';
  }
}

async function readStorage<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch {
    throw new AppLoadError(
      'storage',
      'Device storage is unavailable. Please try again.',
    );
  }
}

/** Validate development data separately from stored-data and IO failures. */
export async function loadAppState(seed: AppDataState): Promise<AppDataState> {
  try {
    initialize(seed);
  } catch (error) {
    throw new AppLoadError(
      'seed',
      error instanceof Error ? error.message : 'Invalid startup data.',
    );
  }
  const source = seed.data.history.source;
  // Every supported format takes the same validation and demo-migration path.
  async function finish(restored: AppDataState, migrate = false) {
    const refreshed = refreshDemoExamples(restored, seed);
    const updated = refreshed === restored ? restored : initialize(refreshed);
    if (migrate || updated !== restored) {
      await readStorage(() =>
        saveAppData(updated.data, migrate ? undefined : restored.data),
      );
    }
    return updated;
  }
  try {
    const raw = await readStorage(() => AsyncStorage.getItem(rootKey(source)));
    if (raw !== null) {
      const envelope: unknown = JSON.parse(raw);
      if (
        !isRecord(envelope) ||
        envelope.version !== 2 ||
        !isRecord(envelope.data) ||
        typeof envelope.indexKey !== 'string' ||
        !envelope.indexKey.startsWith(`${rootKey(source)}/history/`)
      ) {
        throw new Error('Saved app settings are invalid.');
      }
      const indexKey = envelope.indexKey;
      const indexRaw = await readStorage(() => AsyncStorage.getItem(indexKey));
      const index: unknown = indexRaw === null ? null : JSON.parse(indexRaw);
      if (
        !isRecord(index) ||
        (index.version !== 1 && index.version !== 2) ||
        !Array.isArray(index.ids) ||
        !index.ids.every((id: unknown) => typeof id === 'string') ||
        new Set(index.ids).size !== index.ids.length
      ) {
        throw new Error('Saved message index is invalid.');
      }
      const messagePrefix =
        index.version === 2 ? index.messagePrefix : indexKey;
      if (
        typeof messagePrefix !== 'string' ||
        !messagePrefix.startsWith(`${rootKey(source)}/history/`)
      )
        throw new Error('Saved message location is invalid.');
      const ids = index.ids as string[];
      const entries = ids.length
        ? await readStorage(() =>
            AsyncStorage.multiGet(
              ids.map((id) => messageKey(messagePrefix, id)),
            ),
          )
        : [];
      const values = new Map(entries);
      const messages = ids.map((id) => {
        const body = values.get(messageKey(messagePrefix, id));
        const message: unknown = body == null ? null : JSON.parse(body);
        if (!isRecord(message) || message.id !== id)
          throw new Error(`Saved message ${id} is missing or invalid.`);
        return message;
      });
      const restored = parseSavedState(
        { version: 1, data: { ...envelope.data, messages } },
        seed,
      );
      locations.set(source, { indexKey, messagePrefix, ids: new Set(ids) });
      return await finish(restored);
    }
    locations.delete(source);
    const old = await readStorage(() => AsyncStorage.getItem(oldKey(source)));
    if (old !== null)
      return await finish(parseSavedState(JSON.parse(old), seed), true);
    const legacy = await readStorage(() => AsyncStorage.getItem(LEGACY_KEY));
    // Persist coverage immediately, even if the user makes no edits this session.
    if (legacy === null) return await finish(initialize(seed), true);
    const saved: unknown = JSON.parse(legacy);
    if (
      !isRecord(saved) ||
      saved.version !== 1 ||
      !isRecord(saved.library) ||
      saved.library.id !== 'clikd-codes' ||
      !Array.isArray(saved.library.codewords) ||
      typeof saved.activeLibraryId !== 'string'
    ) {
      throw new Error('Saved library settings are invalid.');
    }
    return await finish(
      initialize({
        ...seed,
        data: {
          ...seed.data,
          messages:
            source === 'demo'
              ? seed.data.messages.map((message) => ({
                  ...message,
                  id: message.id.replace('demo-v3-', 'demo-v2-'),
                }))
              : seed.data.messages,
          libraries: {
            ...seed.data.libraries,
            'clikd-codes': {
              ...(saved.library as CodeLibrary),
              name: 'Clickd Codes',
            },
          },
          activeLibraryId: saved.activeLibraryId,
        },
      }),
      true,
    );
  } catch (error) {
    if (error instanceof AppLoadError) throw error;
    throw new AppLoadError(
      'saved',
      error instanceof Error ? error.message : 'Saved data is invalid.',
    );
  }
}

function metadata(data: SharedAppData) {
  const { messages: _messages, ...settings } = data;
  return settings;
}

/** Prepare immutable history first, then commit settings and history with one root write. */
export async function saveAppData(
  data: SharedAppData,
  previous?: SharedAppData,
): Promise<void> {
  const source = data.history.source;
  const current = locations.get(source);
  const historyChanged =
    !current || !previous || previous.messages !== data.messages;
  const settings = metadata(data);
  const settingsChanged =
    !current ||
    !previous ||
    JSON.stringify(settings) !== JSON.stringify(metadata(previous));
  if (!historyChanged && !settingsChanged) return;

  const indexKey = historyChanged
    ? `${rootKey(source)}/history/${Date.now()}-${Math.random().toString(36).slice(2)}`
    : current!.indexKey;
  // Message bodies stay immutable and shared between successive index generations.
  const messagePrefix = current?.messagePrefix ?? indexKey;
  try {
    if (historyChanged) {
      const additions = data.messages.filter(
        (message) => !current?.ids.has(message.id),
      );
      if (additions.length) {
        await AsyncStorage.multiSet(
          additions.map((message: Message): [string, string] => [
            messageKey(messagePrefix, message.id),
            JSON.stringify(message),
          ]),
        );
      }
      await AsyncStorage.setItem(
        indexKey,
        JSON.stringify({
          version: 2,
          messagePrefix,
          ids: data.messages.map((message) => message.id),
        }),
      );
    }
    // The existing root and index remain usable until this single commit succeeds.
    await AsyncStorage.setItem(
      rootKey(source),
      JSON.stringify({ version: 2, indexKey, data: settings }),
    );
  } catch (error) {
    if (historyChanged) {
      try {
        await AsyncStorage.removeItem(indexKey);
      } catch {
        /* An unused index can be cleaned up later. */
      }
    }
    throw error;
  }
  locations.set(source, {
    indexKey,
    messagePrefix,
    ids: historyChanged
      ? new Set(data.messages.map((message) => message.id))
      : current!.ids,
  });
  if (historyChanged && current && current.indexKey !== indexKey) {
    // Delete only the old index record; bodies under its prefix are still shared.
    try {
      await AsyncStorage.removeItem(current.indexKey);
    } catch {
      /* Cleanup must not invalidate a committed save. */
    }
  }
}

/** Preserve every active format before resetting; backup/write failures leave old data usable. */
export async function recoverAppState(
  seed: AppDataState,
): Promise<AppDataState> {
  const defaults = initialize(seed);
  const source = seed.data.history.source;
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) =>
      key === LEGACY_KEY ||
      key === oldKey(source) ||
      key === rootKey(source) ||
      key.startsWith(`${rootKey(source)}/`),
  );
  const entries = await AsyncStorage.multiGet(keys);
  await AsyncStorage.setItem(
    `@clikd/recovery/${Date.now()}`,
    JSON.stringify(entries),
  );
  const prior = locations.get(source);
  locations.delete(source);
  try {
    await saveAppData(defaults.data);
  } catch (error) {
    if (prior) locations.set(source, prior);
    throw error;
  }
  return defaults;
}

/** Validate stored snapshots and fill settings introduced by newer app versions. */
function parseSavedState(saved: unknown, seed: AppDataState): AppDataState {
  if (
    !isRecord(saved) ||
    saved.version !== 1 ||
    !isRecord(saved.data) ||
    !isRecord(saved.data.history) ||
    !isRecord(saved.data.libraries) ||
    !isRecord(saved.data.libraries['clikd-codes']) ||
    saved.data.history.source !== seed.data.history.source
  ) {
    throw new Error('Saved app data is not valid for this version of Clickd.');
  }
  // initialize validates every profile, codeword, message, preference, and link.
  const data = {
    ...saved.data,
    // Older saves and Fast Refresh sessions can predate the appearance setting.
    // Fill only the missing field; never replace saved messages or codewords.
    preferences: isRecord(saved.data.preferences)
      ? {
          themeId:
            saved.data.preferences.themeId ??
            saved.data.preferences.homeBackground ??
            'classic',
          idleLedColor:
            saved.data.preferences.idleLedColor ??
            seed.data.preferences.idleLedColor,
          sentLedColor:
            saved.data.preferences.sentLedColor ??
            seed.data.preferences.sentLedColor,
        }
      : saved.data.preferences,
    libraries: {
      ...saved.data.libraries,
      'clikd-codes': {
        ...saved.data.libraries['clikd-codes'],
        name: 'Clickd Codes',
      },
      'morse-code': seed.data.libraries['morse-code'],
    },
  } as unknown as SharedAppData;
  return initialize({
    data,
    device: seed.device,
  });
}
