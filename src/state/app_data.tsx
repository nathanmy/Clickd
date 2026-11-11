import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from 'react';
import { APP_THEMES } from '@/constants/theme';

import { initialize, reducer, type Action } from './model';
import { saveAppData } from './storage';
import {
  codewordSaveError,
  copyMessage,
  copyProfile,
  isBattery,
  isId,
  isStatus,
  isText,
  messageError,
  preferencesError,
  profileError,
} from './validation';
import type {
  ActionResult,
  AppDataState,
  Codeword,
  ConnectionStatus,
  DeviceState,
  Message,
  Preferences,
  Profile,
  SharedAppData,
} from './types';

type AppActions = Readonly<{
  moveCodeword: (
    libraryId: string,
    codewordId: string,
    targetId: string,
  ) => Promise<ActionResult>;
  deleteCodeword: (
    libraryId: string,
    codewordId: string,
  ) => Promise<ActionResult>;
  setActiveLibrary: (libraryId: string) => Promise<ActionResult>;
  saveCodeword: (
    libraryId: string,
    input: Omit<Codeword, 'id'>,
    codewordId?: string,
  ) => Promise<ActionResult>;
  addMessage: (message: Message) => Promise<ActionResult>;

  /** Upsert metadata; a message can arrive before its sender's profile. */
  updateProfile: (profile: Profile) => Promise<ActionResult>;

  linkPartner: (
    profile: Profile,
    conversationId: string,
  ) => Promise<ActionResult>;
  unlinkPartner: () => Promise<ActionResult>;
  /** Pass only changed fields; the queue merges them into the latest settings. */
  updatePreferences: (changes: Partial<Preferences>) => Promise<ActionResult>;
  setConnectionStatus: (status: ConnectionStatus) => ActionResult;
  setBattery: (battery: number | null) => ActionResult;
}>;

const DataContext = createContext<SharedAppData | null>(null);
const DeviceContext = createContext<DeviceState | null>(null);
const ActionsContext = createContext<AppActions | null>(null);

const OK: ActionResult = Object.freeze({ ok: true });
let codewordCounter = 0;

const fail = (error: string): ActionResult => ({ ok: false, error });
type DurableAction = Exclude<
  Action,
  { type: 'device/connection' | 'device/battery' }
>;

type Props = PropsWithChildren<{
  /** Initial state is read once. Actions perform all later updates. */
  initialState?: AppDataState;
}>;

export function AppDataProvider({ children, initialState }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState, initialize);
  const currentUserId = state.data.currentUserId;
  const savedData = useRef(state.data);
  const writeQueue = useRef(Promise.resolve());

  // Serialize all durable changes and publish only after storage succeeds.
  const commitChange = useCallback(
    (createAction: (data: SharedAppData) => DurableAction | ActionResult) => {
      const operation = writeQueue.current.then<ActionResult>(async () => {
        const action = createAction(savedData.current);
        if ('ok' in action) return action;
        const next = reducer(
          {
            data: savedData.current,
            device: { connectionStatus: 'disconnected', battery: null },
          },
          action,
        ).data;
        if (next === savedData.current) return OK;
        try {
          await saveAppData(next, savedData.current);
        } catch {
          return fail(
            'Could not save your changes on this device. Please try again.',
          );
        }
        savedData.current = next;
        dispatch(action);
        return OK;
      });
      writeQueue.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [],
  );

  const actions = useMemo<AppActions>(
    () => ({
      moveCodeword(libraryId, codewordId, targetId) {
        return commitChange(({ libraries }) => {
          const library = libraries[libraryId];
          if (libraryId !== 'clikd-codes' || !library)
            return fail('Only Clickd codewords can be reordered.');
          if (
            ![codewordId, targetId].every((id) =>
              library.codewords.some((word) => word.id === id),
            )
          )
            return fail('This codeword is no longer available.');
          return { type: 'codeword/move', libraryId, codewordId, targetId };
        });
      },
      deleteCodeword(libraryId, codewordId) {
        return commitChange(({ libraries }) => {
          if (libraryId !== 'clikd-codes')
            return fail('Only Clickd codewords can be deleted.');
          const library = libraries[libraryId];
          if (!library?.codewords.some((word) => word.id === codewordId)) {
            return fail('This codeword is no longer available.');
          }
          return { type: 'codeword/delete', libraryId, codewordId };
        });
      },
      setActiveLibrary(libraryId) {
        return commitChange(({ libraries }) => {
          if (!Object.prototype.hasOwnProperty.call(libraries, libraryId)) {
            return fail('This library is no longer available.');
          }
          return { type: 'library/select', libraryId };
        });
      },
      saveCodeword(libraryId, input, codewordId) {
        // Capture the draft before awaiting the queued write.
        const draft = {
          ...input,
          ...(input.vibration ? { vibration: { ...input.vibration } } : {}),
        };
        return commitChange(({ libraries }) => {
          const library = Object.prototype.hasOwnProperty.call(
            libraries,
            libraryId,
          )
            ? libraries[libraryId]
            : undefined;
          if (!library) return fail('This library is no longer available.');
          if (!draft.code) return fail('Add at least one short or long click.');
          if (!isText(draft.meaning))
            return fail('Enter a meaning for this codeword.');
          const existing = library.codewords.find(
            (word) => word.id === codewordId,
          );
          if (codewordId !== undefined && !existing)
            return fail('This codeword is no longer available.');
          const word: Codeword = {
            ...draft,
            id: existing?.id ?? `custom-${Date.now()}-${++codewordCounter}`,
            meaning: draft.meaning.trim(),
          };
          const error = codewordSaveError(
            library,
            word,
            codewordId === undefined,
          );
          if (error) return fail(error);
          return {
            type: 'codeword/save',
            libraryId,
            word,
            creating: codewordId === undefined,
          };
        });
      },
      async addMessage(message) {
        const error = messageError(message);
        if (error) return fail(error);

        const snapshot = copyMessage(message);
        return commitChange(() => ({ type: 'message/add', message: snapshot }));
      },

      async updateProfile(profile) {
        const error = profileError(profile);
        if (error) return fail(error);

        const snapshot = copyProfile(profile);
        return commitChange(() => ({
          type: 'profile/update',
          profile: snapshot,
        }));
      },

      async linkPartner(profile, conversationId) {
        const error = profileError(profile);
        if (error) return fail(error);

        if (profile.id === currentUserId)
          return fail('You cannot link yourself as your partner.');

        if (!isId(conversationId))
          return fail('A partner link needs a stable conversation ID.');

        const snapshot = copyProfile(profile);
        return commitChange(() => ({
          type: 'partner/link',
          profile: snapshot,
          conversationId,
        }));
      },

      unlinkPartner() {
        return commitChange(() => ({ type: 'partner/unlink' }));
      },

      updatePreferences(changes) {
        const patch = { ...changes };
        return commitChange((data) => {
          const preferences = { ...data.preferences, ...patch };
          const error = preferencesError(preferences);
          return error
            ? fail(error)
            : { type: 'preferences/update', preferences };
        });
      },
      setConnectionStatus(status) {
        if (!isStatus(status)) return fail('Unknown device connection status.');

        dispatch({
          type: 'device/connection',
          status,
        });

        return OK;
      },

      setBattery(battery) {
        if (!isBattery(battery))
          return fail('Battery must be null or a percentage from 0 to 100.');

        dispatch({
          type: 'device/battery',
          battery,
        });

        return OK;
      },
    }),
    [currentUserId, dispatch, commitChange],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <DataContext.Provider value={state.data}>
        <DeviceContext.Provider value={state.device}>
          {children}
        </DeviceContext.Provider>
      </DataContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useAppData(): SharedAppData {
  const value = useContext(DataContext);

  if (value === null)
    throw new Error('useAppData must be inside AppDataProvider.');

  return value;
}

export function useDeviceData(): DeviceState {
  const value = useContext(DeviceContext);

  if (value === null)
    throw new Error('useDeviceData must be inside AppDataProvider.');

  return value;
}

/** Read the selected palette without duplicating theme identifiers. */
export function useThemeBackground(): string {
  return useAppTheme().color;
}

export function useAppTheme() {
  return APP_THEMES[useAppData().preferences.themeId];
}

export function useAppActions(): AppActions {
  const value = useContext(ActionsContext);

  if (value === null)
    throw new Error('useAppActions must be inside AppDataProvider.');

  return value;
}
