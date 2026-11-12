import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type GestureResponderEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppActions, useAppData } from '@/state/app_data';
import type { CodeLibrary, Message, PressTiming } from '@/state/types';
import { useReplay } from '@/features/keycap/replay';
import {
  HOLD_THRESHOLD_MS,
  SEQUENCE_PAUSE_MS,
  MORSE_LETTER_PAUSE_MS,
  MORSE_SEND_PAUSE_MS,
  MAX_PLAYBACK_PRESSES,
  MAX_CODE_CLICKS,
  MAX_PRESS_DURATION_MS,
  resolveInput,
  type ResolvedInput,
} from './input';

let messageCounter = 0;
type Draft = ResolvedInput & { conversationId: string | null };

/** Own recording, cancellation, timers, and session-only delivery outside the screen. */
export function useDeviceSimulator() {
  const { libraries, activeLibraryId, activeConversationId, partnerId } =
    useAppData();
  const { receiveSimulatedMessage } = useAppActions();
  const library = libraries[activeLibraryId];
  const morse = library.id === 'morse-code';
  const { frame, playingId, replay, stop } = useReplay();
  const [presses, setPresses] = useState<readonly PressTiming[]>([]);
  const [holding, setHolding] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastReceived, setLastReceived] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pauseStarted, setPauseStarted] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const locked = useRef(false);
  const recording = useRef<PressTiming[]>([]);
  const startedAt = useRef<number | null>(null);
  const downAt = useRef<number | null>(null);
  const lastRelease = useRef<number | null>(null);
  const capturedLibrary = useRef<CodeLibrary>(library);
  const capturedConversation = useRef<string | null>(activeConversationId);
  const completed = useRef(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const cancelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const receiveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const clearTimers = useCallback(() => {
    clearTimeout(cancelTimer.current);
    clearTimeout(receiveTimer.current);
    clearTimeout(pauseTimer.current);
    clearTimeout(holdTimer.current);
    pauseTimer.current = undefined;
    holdTimer.current = undefined;
  }, []);
  const clear = useCallback(() => {
    clearTimers();
    stop();
    recording.current = [];
    startedAt.current = null;
    downAt.current = null;
    lastRelease.current = null;
    completed.current = false;
    setPresses([]);
    setHolding(false);
    setPauseStarted(null);
    setDraft(null);
    setLastReceived(null);
    setError('');
    setNotice('');
  }, [clearTimers, stop]);
  useEffect(() => {
    clear();
  }, [activeLibraryId, activeConversationId, partnerId, clear]);
  useFocusEffect(useCallback(() => () => clear(), [clear]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && !completed.current && !locked.current) clear();
    });
    return () => subscription.remove();
  }, [clear]);

  // Visual feedback follows the same monotonic clock as the recorded presses.
  useEffect(() => {
    if (!holding && pauseStarted === null) return;
    const timer = setInterval(() => setClock(performance.now()), 50);
    return () => clearInterval(timer);
  }, [holding, pauseStarted]);

  function finish(automaticallyReceive = false) {
    if (automaticallyReceive) setPauseStarted(null);
    completed.current = !morse || automaticallyReceive;
    try {
      const resolved = {
        ...resolveInput(recording.current, capturedLibrary.current),
        conversationId: capturedConversation.current,
      };
      setDraft(resolved);
      setError('');
      if (automaticallyReceive) {
        if (resolved.word) send(resolved);
        else setError('Unknown sequence. Clear and try again.');
      }
    } catch (failure) {
      setDraft(null);
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not interpret this recording.',
      );
    }
  }
  function beginPress() {
    if (locked.current || downAt.current !== null) return;
    // A delayed JS timer must not merge input across the automatic receive boundary.
    if (
      lastRelease.current !== null &&
      performance.now() - lastRelease.current >=
        (morse ? MORSE_SEND_PAUSE_MS : SEQUENCE_PAUSE_MS) &&
      !completed.current
    ) {
      finish(true);
      if (recording.current.length) return;
    }
    if (completed.current) clear();
    if (
      recording.current.length >=
      (morse ? MAX_PLAYBACK_PRESSES : MAX_CODE_CLICKS)
    ) {
      setError('Message limit reached. Pause to receive it.');
      return;
    }
    clearTimers();
    stop();
    const now = performance.now();
    if (startedAt.current === null) {
      startedAt.current = now;
      capturedLibrary.current = library;
      capturedConversation.current = activeConversationId;
      setLastReceived(null);
    }
    downAt.current = now;
    setClock(now);
    setPauseStarted(null);
    setHolding(true);
    if (!morse) setDraft(null);
    setNotice('');
    setError('');
    holdTimer.current = setTimeout(() => {
      clear();
      setError('That hold was too long. Please try again.');
    }, MAX_PRESS_DURATION_MS);
  }
  // Pressable also emits press-out for cancelled gestures. Only onPress commits input.
  function cancelPress(event: GestureResponderEvent) {
    if (downAt.current === null) return;
    if (Platform.OS === 'web' && 'type' in event.nativeEvent) {
      // Mobile browsers can delay click after touchend; don't wait for that click.
      const released = ['touchend', 'mouseup', 'pointerup', 'keyup'].includes(
        String(event.nativeEvent.type),
      );
      if (released) endPress();
      else clear();
      return;
    }
    clearTimeout(cancelTimer.current);
    cancelTimer.current = setTimeout(() => {
      if (downAt.current !== null) clear();
    }, 0);
  }
  function endPress() {
    clearTimeout(cancelTimer.current);
    if (downAt.current === null || startedAt.current === null || locked.current)
      return;
    clearTimeout(holdTimer.current);
    const previous = recording.current.at(-1);
    const offsetMs = Math.max(
      Math.round(downAt.current - startedAt.current),
      previous ? previous.offsetMs + previous.durationMs : 0,
    );
    const endMs = Math.round(performance.now() - startedAt.current);
    const durationMs = Math.max(1, endMs - offsetMs);
    downAt.current = null;
    recording.current = [...recording.current, { offsetMs, durationMs }];
    setPresses(recording.current);
    const releasedAt = performance.now();
    lastRelease.current = releasedAt;
    setClock(releasedAt);
    setPauseStarted(releasedAt);
    setHolding(false);
    if (morse) {
      pauseTimer.current = setTimeout(() => finish(), MORSE_LETTER_PAUSE_MS);
      receiveTimer.current = setTimeout(
        () => finish(true),
        MORSE_SEND_PAUSE_MS,
      );
    } else {
      pauseTimer.current = setTimeout(() => finish(true), SEQUENCE_PAUSE_MS);
    }
  }
  function send(selected: Draft) {
    if (
      locked.current ||
      !selected?.word ||
      !partnerId ||
      !selected.conversationId ||
      selected.conversationId !== activeConversationId
    ) {
      setError(
        'A linked partner and conversation are needed to receive messages.',
      );
      return;
    }
    locked.current = true;
    setSaving(true);
    setError('');
    stop();
    const message: Message = {
      ...selected.word,
      id: `simulator-${Date.now()}-${++messageCounter}`,
      library: selected.library,
      presses: selected.presses,
      conversationId: selected.conversationId,
      senderId: partnerId,
      createdAt: new Date().toISOString(),
    };
    try {
      const result = receiveSimulatedMessage(message);
      if (result.ok) {
        clear();
        setLastReceived(selected);
        setNotice('Received');
      } else setError(result.error);
    } catch {
      setError('Could not receive this test message. Please try again.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }
  const preview =
    !holding && pauseStarted === null ? (draft ?? lastReceived) : null;
  const displayedWord = draft?.word ?? lastReceived?.word;
  const pauseDuration = morse ? MORSE_SEND_PAUSE_MS : SEQUENCE_PAUSE_MS;
  const pauseElapsed =
    pauseStarted === null ? 0 : Math.max(0, clock - pauseStarted);
  const progress = Math.min(1, pauseElapsed / pauseDuration);
  const pausing = pauseStarted !== null && !holding && !error;
  const longPress =
    holding &&
    downAt.current !== null &&
    clock - downAt.current >= HOLD_THRESHOLD_MS;
  const inputStatus = holding
    ? longPress
      ? morse
        ? 'Dash'
        : 'Long click'
      : morse
        ? 'Dot'
        : 'Short click'
    : pausing
      ? morse && pauseElapsed < MORSE_LETTER_PAUSE_MS
        ? 'Continue letter...'
        : morse
          ? 'Next letter...'
          : 'Receiving...'
      : error
        ? 'Check your recording'
        : 'Tap or hold the keycap';
  return {
    library,
    morse,
    activeConversationId,
    partnerId,
    frame,
    playingId,
    replay,
    stop,
    presses,
    holding,
    lastReceived,
    saving,
    error,
    notice,
    preview,
    displayedWord,
    pauseDuration,
    pauseElapsed,
    progress,
    pausing,
    inputStatus,
    beginPress,
    endPress,
    cancelPress,
    clear,
  };
}
