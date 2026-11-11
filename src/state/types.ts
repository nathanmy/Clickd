import type { LightingSequence, PressTiming } from '@/features/keycap/codes';
import type { ThemeId } from '@/constants/theme';
export type { PressTiming } from '@/features/keycap/codes';

export type Profile = Readonly<{
  id: string;
  name: string;
  photoUrl: string | null;
}>;

export type VibrationSettings = Readonly<{
  enabled: boolean;
  strength: number;
}>;

export type Codeword = Readonly<
  LightingSequence & {
    id: string;
    meaning: string;
    vibration?: VibrationSettings;
  }
>;

export type CodeLibrary = Readonly<{
  id: string;
  name: string;
  revision: number;
  codewords: readonly Codeword[];
}>;

/** Saved content and feedback belong to this occurrence, not a live codeword. */
export type Message = Readonly<
  Codeword & {
    /** Library metadata at send time, independent of the current selection. */
    library: Readonly<Pick<CodeLibrary, 'id' | 'name' | 'revision'>>;
    conversationId: string;
    senderId: string;
    createdAt: string;
    presses?: readonly PressTiming[];
  }
>;

export type Preferences = Readonly<{
  themeId: ThemeId;
  idleLedColor: string;
  sentLedColor: string;
}>;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type DeviceState =
  | Readonly<{
      connectionStatus: 'disconnected' | 'connecting';
      battery: null;
    }>
  | Readonly<{
      connectionStatus: 'connected';
      battery: number | null;
    }>;

export type SharedAppData = Readonly<{
  /** Coverage describes recorded history, not device uptime. */
  history: Readonly<{ source: 'demo' | 'session'; startedAt: string }>;
  currentUserId: string;
  profiles: Readonly<Record<string, Profile>>;
  partnerId: string | null;
  activeConversationId: string | null;
  libraries: Readonly<Record<string, CodeLibrary>>;
  activeLibraryId: string;
  preferences: Preferences;
  /** All conversations, sorted by createdAt and then ID. */
  messages: readonly Message[];
}>;

export type LibrarySettings = Pick<
  SharedAppData,
  'libraries' | 'activeLibraryId'
>;

export type AppDataState = Readonly<{
  data: SharedAppData;
  device: DeviceState;
}>;

/** Valid input was dispatched; duplicates and stale telemetry can be no-ops. */
export type ActionResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: string }>;
