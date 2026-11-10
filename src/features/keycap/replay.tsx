import { useCallback, useEffect, useRef, useState } from 'react';

import type { ReplayableCode } from '@/features/keycap/codes';

import { createPlaybackFrames, idleFrame, schedulePlayback, type LedFrame } from './lighting';

export function useReplay() {
  const [frame, setFrame] = useState<LedFrame>(idleFrame);

  const [playingId, setPlayingId] =
    useState<string | number | null>(null);

  const currentId = useRef<string | number | null>(null);

  const cancelPlayback = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelPlayback.current?.(), []);

  const stop = useCallback(() => {
    cancelPlayback.current?.();
    cancelPlayback.current = null;

    currentId.current = null;
    setPlayingId(null);
    setFrame(idleFrame());
  }, []);

  const replay = useCallback(
    (sequence: ReplayableCode) => {
      const alreadyPlaying = currentId.current === sequence.id;

      stop();

      // Tapping the active message again stops it.
      if (alreadyPlaying) return;

      const { frames, duration } =
        createPlaybackFrames(sequence);

      if (!frames.length) return;

      currentId.current = sequence.id;
      setPlayingId(sequence.id);

      cancelPlayback.current = schedulePlayback(frames, duration, setFrame, stop);
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
