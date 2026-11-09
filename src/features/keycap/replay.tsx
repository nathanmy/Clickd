import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  createPlaybackFrames,
  idleFrame,
  type LedFrame,
  type ReplayableCode,
} from './lighting';

export function useReplay() {
  const [frame, setFrame] = useState<LedFrame>(idleFrame);

  const [playingId, setPlayingId] =
    useState<string | number | null>(null);

  const currentId =
    useRef<string | number | null>(null);

  const timers =
    useRef<ReturnType<typeof setTimeout>[]>([]);

  const generation = useRef(0);

  // Cancel pending playback timers.
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // Clean up when component unmounts.
  useEffect(
    () => () => clearTimers(),
    [clearTimers]
  );

  const stop = useCallback(() => {
    generation.current++;
    clearTimers();

    currentId.current = null;
    setPlayingId(null);
    setFrame(idleFrame());
  }, [clearTimers]);

  const replay = useCallback(
    (sequence: ReplayableCode) => {
      const alreadyPlaying =
        currentId.current === sequence.id;

      stop();

      // Tapping the active message again stops it.
      if (alreadyPlaying) return;

      const { frames, duration } =
        createPlaybackFrames(sequence);

      if (!frames.length) return;

      const token = generation.current;

      currentId.current = sequence.id;
      setPlayingId(sequence.id);

      // Apply first LED frame immediately.
      setFrame(frames[0]);

      // Schedule remaining frames.
      frames.slice(1).forEach(next => {
        timers.current.push(
          setTimeout(() => {
            if (generation.current === token) {
              setFrame(next);
            }
          }, next.at)
        );
      });

      // Return to idle at the end of playback.
      timers.current.push(
        setTimeout(() => {
          if (generation.current === token) {
            stop();
          }
        }, duration + 20)
      );
    },
    [stop]
  );

  return {
    frame,
    playingId,
    replay,
    stop,
  };
}