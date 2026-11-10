import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type PropsWithChildren } from 'react';

import { initialize, reducer, reduceLibrarySettings, type LibraryAction } from './model';
import { saveLibrarySettings } from './storage';
import { codewordSaveError, copyMessage, copyProfile, isBattery, isId, isStatus, isText, messageError, profileError } from './validation';
import type {
  ActionResult,
  AppDataState,
  Codeword,
  ConnectionStatus,
  DeviceState,
  Message,
  LibrarySettings,
  Profile,
  SharedAppData,
} from './types';

type AppActions = Readonly<{
  deleteCodeword: (libraryId: string, codewordId: string) => Promise<ActionResult>;
  setActiveLibrary: (libraryId: string) => Promise<ActionResult>;
  saveCodeword: (libraryId: string, input: Omit<Codeword, 'id'>, codewordId?: string) => Promise<ActionResult>;
  addMessage: (message: Message) => ActionResult;

  /** Upsert metadata; a message can arrive before its sender's profile. */
  updateProfile: (profile: Profile) => ActionResult;

  linkPartner: (profile: Profile, conversationId: string) => ActionResult;
  unlinkPartner: () => void;
  setConnectionStatus: (status: ConnectionStatus) => ActionResult;
  setBattery: (battery: number | null) => ActionResult;
}>;

const DataContext = createContext<SharedAppData | null>(null);
const DeviceContext = createContext<DeviceState | null>(null);
const ActionsContext = createContext<AppActions | null>(null);

const OK: ActionResult = Object.freeze({ ok: true });
let codewordCounter = 0;

const fail = (error: string): ActionResult => ({ ok: false, error });

type Props = PropsWithChildren<{
  /** Initial state is read once. Actions perform all later updates. */
  initialState?: AppDataState;
}>;

export function AppDataProvider({ children, initialState }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState, initialize);
  const currentUserId = state.data.currentUserId;
  const savedSettings = useRef<LibrarySettings>({
    libraries: state.data.libraries,
    activeLibraryId: state.data.activeLibraryId,
  });
  const writeQueue = useRef(Promise.resolve());

  // Serialize library edits and selections; publish them only after storage succeeds.
  const commitLibraryChange = useCallback((createAction: (settings: LibrarySettings) => LibraryAction | ActionResult) => {
    const operation = writeQueue.current.then<ActionResult>(async () => {
      const action = createAction(savedSettings.current);
      if ('ok' in action) return action;
      const next = reduceLibrarySettings(savedSettings.current, action);
      if (next === savedSettings.current) return OK;
      try {
        await saveLibrarySettings(next);
      } catch {
        return fail('Could not save your library on this device. Please try again.');
      }
      savedSettings.current = next;
      dispatch(action);
      return OK;
    });
    writeQueue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      deleteCodeword(libraryId, codewordId) {
        return commitLibraryChange(({ libraries }) => {
          if (libraryId !== 'clikd-codes') return fail('Only Clikd codewords can be deleted.');
          const library = libraries[libraryId];
          if (!library?.codewords.some((word) => word.id === codewordId)) {
            return fail('This codeword is no longer available.');
          }
          return { type: 'codeword/delete', libraryId, codewordId };
        });
      },
      setActiveLibrary(libraryId) {
        return commitLibraryChange(({ libraries }) => {
          if (!Object.prototype.hasOwnProperty.call(libraries, libraryId)) {
            return fail('This library is no longer available.');
          }
          return { type: 'library/select', libraryId };
        });
      },
      saveCodeword(libraryId, input, codewordId) {
        // Capture the draft before awaiting the queued write.
        const draft = { ...input, ...(input.vibration ? { vibration: { ...input.vibration } } : {}) };
        return commitLibraryChange(({ libraries }) => {
          const library = Object.prototype.hasOwnProperty.call(libraries, libraryId)
            ? libraries[libraryId] : undefined;
          if (!library) return fail('This library is no longer available.');
          if (!draft.code) return fail('Add at least one short or long click.');
          if (!isText(draft.meaning)) return fail('Enter a meaning for this codeword.');
          const existing = library.codewords.find((word) => word.id === codewordId);
          if (codewordId !== undefined && !existing) return fail('This codeword is no longer available.');
          const word: Codeword = {
            ...draft,
            id: existing?.id ?? `custom-${Date.now()}-${++codewordCounter}`,
            meaning: draft.meaning.trim(),
          };
          const error = codewordSaveError(library, word, codewordId === undefined);
          if (error) return fail(error);
          return { type: 'codeword/save', libraryId, word, creating: codewordId === undefined };
        });
      },
      addMessage(message) {
        const error = messageError(message);
        if (error) return fail(error);

        dispatch({
          type: 'message/add',
          message: copyMessage(message),
        });

        return OK;
      },

      updateProfile(profile) {
        const error = profileError(profile);
        if (error) return fail(error);

        dispatch({
          type: 'profile/update',
          profile: copyProfile(profile),
        });

        return OK;
      },

      linkPartner(profile, conversationId) {
        const error = profileError(profile);
        if (error) return fail(error);

        if (profile.id === currentUserId)
          return fail('You cannot link yourself as your partner.');

        if (!isId(conversationId))
          return fail('A partner link needs a stable conversation ID.');

        dispatch({
          type: 'partner/link',
          profile: copyProfile(profile),
          conversationId,
        });

        return OK;
      },

      unlinkPartner() {
        dispatch({
          type: 'partner/unlink',
        });
      },

      setConnectionStatus(status) {
        if (!isStatus(status))
          return fail('Unknown device connection status.');

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
    [currentUserId, dispatch, commitLibraryChange],
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

export function useAppActions(): AppActions {
  const value = useContext(ActionsContext);

  if (value === null)
    throw new Error('useAppActions must be inside AppDataProvider.');

  return value;
}
