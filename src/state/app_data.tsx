import { createContext, useContext, useMemo, useReducer, type PropsWithChildren } from 'react';

import { initialize, reducer } from './model';
import { copyMessage, copyProfile, isBattery, isId, isStatus, messageError, profileError } from './validation';
import type {
  ActionResult,
  AppDataState,
  ConnectionStatus,
  DeviceState,
  Message,
  Profile,
  SharedAppData,
} from './types';

type AppActions = Readonly<{
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

const fail = (error: string): ActionResult => ({ ok: false, error });

type Props = PropsWithChildren<{
  /** Initial state is read once. Actions perform all later updates. */
  initialState?: AppDataState;
}>;

export function AppDataProvider({ children, initialState }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState, initialize);
  const currentUserId = state.data.currentUserId;

  const actions = useMemo<AppActions>(
    () => ({
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
    [currentUserId, dispatch],
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
