import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialize } from './model';
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
  { indexKey: string; ids: ReadonlySet<string> }
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
        index.version !== 1 ||
        !Array.isArray(index.ids) ||
        !index.ids.every((id: unknown) => typeof id === 'string') ||
        new Set(index.ids).size !== index.ids.length
      ) {
        throw new Error('Saved message index is invalid.');
      }
      const ids = index.ids as string[];
      const entries = ids.length
        ? await readStorage(() =>
            AsyncStorage.multiGet(ids.map((id) => messageKey(indexKey, id))),
          )
        : [];
      const values = new Map(entries);
      const messages = ids.map((id) => {
        const body = values.get(messageKey(indexKey, id));
        const message: unknown = body == null ? null : JSON.parse(body);
        if (!isRecord(message) || message.id !== id)
          throw new Error(`Saved message ${id} is missing or invalid.`);
        return message;
      });
      const restored = parseSavedState(
        JSON.stringify({ version: 1, data: { ...envelope.data, messages } }),
        seed,
      );
      locations.set(source, { indexKey, ids: new Set(ids) });
      return restored;
    }
    locations.delete(source);
    const old = await readStorage(() => AsyncStorage.getItem(oldKey(source)));
    if (old !== null) return parseSavedState(old, seed);
    const legacy = await readStorage(() => AsyncStorage.getItem(LEGACY_KEY));
    if (legacy === null) return initialize(seed);
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
    return initialize({
      ...seed,
      data: {
        ...seed.data,
        libraries: {
          ...seed.data.libraries,
          'clikd-codes': { ...(saved.library as CodeLibrary), name: 'Clickd Codes' },
        },
        activeLibraryId: saved.activeLibraryId,
      },
    });
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

/** Write bodies before the index, so interrupted writes cannot expose missing messages. */
export async function saveAppData(
  data: SharedAppData,
  previous?: SharedAppData,
): Promise<void> {
  const source = data.history.source;
  const current = locations.get(source);
  const indexKey =
    current?.indexKey ??
    `${rootKey(source)}/history/${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const historyChanged =
    !current || !previous || previous.messages !== data.messages;
  if (historyChanged) {
    const additions = data.messages.filter(
      (message) => !current?.ids.has(message.id),
    );
    if (additions.length) {
      await AsyncStorage.multiSet(
        additions.map((message: Message): [string, string] => [
          messageKey(indexKey, message.id),
          JSON.stringify(message),
        ]),
      );
    }
    await AsyncStorage.setItem(
      indexKey,
      JSON.stringify({
        version: 1,
        ids: data.messages.map((message) => message.id),
      }),
    );
  }
  const settings = metadata(data);
  if (
    !current ||
    !previous ||
    JSON.stringify(settings) !== JSON.stringify(metadata(previous))
  ) {
    // This is the initial/migration commit point; old v1 data remains untouched.
    await AsyncStorage.setItem(
      rootKey(source),
      JSON.stringify({ version: 2, indexKey, data: settings }),
    );
  }
  locations.set(source, {
    indexKey,
    ids: historyChanged
      ? new Set(data.messages.map((message) => message.id))
      : current!.ids,
  });
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
function parseSavedState(raw: string, seed: AppDataState): AppDataState {
  const saved: unknown = JSON.parse(raw);
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
            saved.data.preferences.homeBackground ??
            saved.data.preferences.themeId ??
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
