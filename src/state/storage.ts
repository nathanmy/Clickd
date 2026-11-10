import AsyncStorage from '@react-native-async-storage/async-storage';

import { initialize } from './model';
import type { AppDataState, CodeLibrary, LibrarySettings } from './types';

const STORAGE_KEY = '@clikd/library-settings-v1';

/** Restore custom codes while keeping canonical Morse entries and session data. */
export async function loadLibrarySettings(seed: AppDataState): Promise<AppDataState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) return seed;
  const saved: unknown = JSON.parse(raw);
  if (
    !saved || typeof saved !== 'object' ||
    !('version' in saved) || saved.version !== 1 ||
    !('library' in saved) || !saved.library || typeof saved.library !== 'object' ||
    !('id' in saved.library) || saved.library.id !== 'clikd-codes' ||
    !('codewords' in saved.library) || !Array.isArray(saved.library.codewords) ||
    !('activeLibraryId' in saved) || typeof saved.activeLibraryId !== 'string'
  ) throw new Error('Saved library settings are not valid for this version of Clikd.');

  // initialize checks every codeword, duplicate sequence, revision, and selection.
  return initialize({
    ...seed,
    data: {
      ...seed.data,
      libraries: { ...seed.data.libraries, 'clikd-codes': saved.library as CodeLibrary },
      activeLibraryId: saved.activeLibraryId,
    },
  });
}

export async function saveLibrarySettings(settings: LibrarySettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    library: settings.libraries['clikd-codes'],
    activeLibraryId: settings.activeLibraryId,
  }));
}
