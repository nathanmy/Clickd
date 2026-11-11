import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentRef,
} from 'react';
import {
  Animated,
  AppState,
  FlatList,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { DEFAULT_THEME as theme } from '@/constants/theme';
import { useAppActions } from '@/state/app_data';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import type { Codeword } from '@/state/types';

const EDGE_PX = 48;
const SCROLL_SPEED_PX = 500;
type DragVisuals = {
  id: string | null;
  offset: Animated.Value;
  shifts: ReadonlyMap<string, number>;
  reducedMotion: boolean;
};
export const DragContext = createContext<DragVisuals | null>(null);
type ReorderCellProps = ComponentProps<
  NonNullable<
    ComponentProps<typeof FlatList<Codeword>>['CellRendererComponent']
  >
>;

/** Animate inside the measured cell, retaining FlatList's original layout metrics. */
export function ReorderCell({
  item,
  children,
  style,
  onLayout,
  onFocusCapture,
}: ReorderCellProps) {
  const visual = useContext(DragContext);
  const [shift] = useState(() => new Animated.Value(0));
  const active = visual?.id === item.id;
  const target = visual?.shifts.get(item.id) ?? 0;
  const reducedMotion = visual?.reducedMotion ?? true;
  useLayoutEffect(() => {
    if (!visual?.id || active || reducedMotion) {
      shift.setValue(active || !visual?.id ? 0 : target);
      return;
    }
    const animation = Animated.spring(shift, {
      toValue: target,
      speed: 25,
      bounciness: 0,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, visual?.id, shift, target, reducedMotion]);
  return (
    <View
      style={[style, { zIndex: active ? 10 : 0 }]}
      onLayout={onLayout}
      onFocusCapture={onFocusCapture}
    >
      <Animated.View
        style={{
          transform: [{ translateY: active && visual ? visual.offset : shift }],
          backgroundColor: '#FFFFFF',
          ...(active ? { boxShadow: '0px 5px 14px rgba(0,0,0,0.18)' } : {}),
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export type ReorderControls = {
  disabled: boolean;
  onStart: (id: string, pageY: number) => void;
  onMove: (dy: number, pageY: number) => void;
  onEnd: () => void;
  onCancel: () => void;
  onStep: (id: string, direction: -1 | 1) => void;
  onMeasure: (id: string, height: number) => void;
};

export function DragHandle({
  item,
  controls,
}: {
  item: Codeword;
  controls: ReorderControls;
}) {
  const { disabled, onStart, onMove, onEnd, onCancel, onStep } = controls;
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !disabled && Math.abs(gesture.dy) > 4,
        onPanResponderGrant: (event) =>
          onStart(item.id, event.nativeEvent.pageY),
        onPanResponderMove: (_, gesture) => onMove(gesture.dy, gesture.moveY),
        onPanResponderRelease: () => onEnd(),
        onPanResponderTerminate: () => onCancel(),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [disabled, item.id, onStart, onMove, onEnd, onCancel],
  );
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`Reorder ${item.meaning}`}
      accessibilityHint="Drag to move, or use the move up and move down actions."
      accessibilityState={{ disabled }}
      accessibilityActions={[
        { name: 'increment', label: 'Move down' },
        { name: 'decrement', label: 'Move up' },
      ]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        if (event.nativeEvent.actionName === 'increment') onStep(item.id, 1);
        if (event.nativeEvent.actionName === 'decrement') onStep(item.id, -1);
      }}
      {...(Platform.OS === 'web'
        ? {
            tabIndex: disabled ? -1 : 0,
            onKeyDown: (
              event: Parameters<NonNullable<ViewProps['onKeyDown']>>[0],
            ) => {
              const key = 'key' in event ? event.key : event.nativeEvent.key;
              if (!disabled && (key === 'ArrowUp' || key === 'ArrowDown')) {
                event.preventDefault();
                onStep(item.id, key === 'ArrowUp' ? -1 : 1);
              }
            },
          }
        : {})}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={20}
        height={24}
        viewBox="0 0 20 24"
        aria-hidden={true}
        focusable={false}
      >
        <Path
          d="M5 6h2m6 0h2M5 12h2m6 0h2M5 18h2m6 0h2"
          stroke={theme.icon}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

type DragSession = {
  id: string;
  targetId: string;
  entries: readonly Codeword[];
  spans: number[];
  targetOffset: number;
  startScroll: number;
  dy: number;
  pointerY: number;
  saving: boolean;
};

/** Own gesture state, edge scrolling, accessibility, and durable reorder writes. */
export function useCodewordReorder(
  entries: readonly Codeword[],
  onError: (message: string) => void,
  listKey: string,
) {
  const { moveCodeword } = useAppActions();
  const list = useRef<FlatList<Codeword>>(null);
  const viewportRef = useRef<ComponentRef<typeof View>>(null);
  const viewport = useRef({ top: 0, height: 0 });
  const scroll = useRef(0);
  const contentHeight = useRef(0);
  const heights = useRef(new Map<string, number>());
  const drag = useRef<DragSession | null>(null);
  const animationFrame = useRef<number | null>(null);
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset] = useState(() => new Animated.Value(0));
  const [shifts, setShifts] = useState<ReadonlyMap<string, number>>(new Map());
  const reducedMotion = useReducedMotion();

  const stopScrolling = useCallback(() => {
    if (animationFrame.current !== null)
      cancelAnimationFrame(animationFrame.current);
    animationFrame.current = null;
  }, []);
  const measureViewport = useCallback(() => {
    viewportRef.current?.measureInWindow((_, top, __, height) => {
      viewport.current = { top, height };
    });
  }, []);

  const updateDrag = useCallback(() => {
    const current = drag.current;
    if (!current || current.saving) return;
    const from = current.entries.findIndex((word) => word.id === current.id);
    if (from < 0) return;
    let total = 0;
    const tops = current.spans.map((height) => {
      const top = total;
      total += height;
      return top;
    });
    const fromTop = tops[from];
    const dy = current.dy + scroll.current - current.startScroll;
    const translation = Math.max(
      -fromTop,
      Math.min(total - fromTop - current.spans[from], dy),
    );
    offset.setValue(translation);
    const position = fromTop + translation;
    // Compare final insertion positions, not old row centers: tall rows can still move past short ones.
    const positions = tops.map((top, index) =>
      index > from ? top + current.spans[index] - current.spans[from] : top,
    );
    let target = from;
    positions.forEach((top, index) => {
      if (Math.abs(top - position) < Math.abs(positions[target] - position))
        target = index;
    });
    const targetId = current.entries[target].id;
    current.targetOffset = positions[target] - fromTop;
    if (targetId === current.targetId) return;
    current.targetId = targetId;
    const displaced = new Map<string, number>();
    current.entries.forEach((word, index) => {
      if (index > from && index <= target)
        displaced.set(word.id, -current.spans[from]);
      if (index >= target && index < from)
        displaced.set(word.id, current.spans[from]);
    });
    setShifts(displaced);
  }, [offset]);

  const cancel = useCallback(() => {
    stopScrolling();
    drag.current = null;
    offset.setValue(0);
    setDraggingId(null);
    setShifts(new Map());
  }, [offset, stopScrolling]);
  useLayoutEffect(() => {
    // FlatList remounts on library changes; its new viewport starts at offset zero.
    cancel();
    scroll.current = 0;
  }, [listKey, cancel]);
  useFocusEffect(useCallback(() => () => cancel(), [cancel]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') cancel();
    });
    return () => {
      subscription.remove();
      stopScrolling();
    };
  }, [cancel, stopScrolling]);

  const saveOrder = useCallback(
    async (id: string, targetId: string) => {
      if (lock.current || id === targetId) return;
      lock.current = true;
      setSaving(true);
      onError('');
      try {
        const result = await moveCodeword('clikd-codes', id, targetId);
        if (!result.ok) onError(result.error);
      } catch {
        onError('Could not save this order. Please try again.');
      } finally {
        lock.current = false;
        setSaving(false);
      }
    },
    [moveCodeword, onError],
  );

  const start = useCallback(
    (id: string, pageY: number) => {
      if (lock.current) return;
      stopScrolling();
      measureViewport();
      offset.setValue(0);
      const measured = [...heights.current.values()];
      const fallback = measured.length
        ? measured.reduce((sum, height) => sum + height, 0) / measured.length
        : 90;
      drag.current = {
        id,
        targetId: id,
        entries,
        spans: entries.map(
          (word) =>
            (heights.current.get(word.id) ?? fallback) +
            StyleSheet.hairlineWidth,
        ),
        targetOffset: 0,
        startScroll: scroll.current,
        dy: 0,
        pointerY: pageY,
        saving: false,
      };
      setDraggingId(id);
      let previous = performance.now();
      function tick(now: number) {
        const current = drag.current;
        if (!current || current.saving) return;
        const elapsed = Math.min(32, now - previous) / 1000;
        previous = now;
        const { top, height } = viewport.current;
        const edge = Math.min(EDGE_PX, height / 3);
        if (edge > 0) {
          const localY = current.pointerY - top;
          const direction =
            localY < edge
              ? -Math.min(1, (edge - localY) / edge)
              : localY > height - edge
                ? Math.min(1, (localY - height + edge) / edge)
                : 0;
          const next = Math.max(
            0,
            Math.min(
              Math.max(0, contentHeight.current - height),
              scroll.current + direction * SCROLL_SPEED_PX * elapsed,
            ),
          );
          if (next !== scroll.current) {
            scroll.current = next;
            list.current?.scrollToOffset({ offset: next, animated: false });
            updateDrag();
          }
        }
        animationFrame.current = requestAnimationFrame(tick);
      }
      animationFrame.current = requestAnimationFrame(tick);
    },
    [entries, offset, measureViewport, stopScrolling, updateDrag],
  );

  const move = useCallback(
    (dy: number, pageY: number) => {
      if (!drag.current || drag.current.saving) return;
      drag.current.dy = dy;
      drag.current.pointerY = pageY;
      updateDrag();
    },
    [updateDrag],
  );
  const end = useCallback(async () => {
    const current = drag.current;
    stopScrolling();
    if (!current) return;
    current.saving = true;
    offset.setValue(current.targetOffset);
    await saveOrder(current.id, current.targetId);
    cancel();
  }, [cancel, offset, saveOrder, stopScrolling]);
  const step = useCallback(
    (id: string, direction: -1 | 1) => {
      const index = entries.findIndex((word) => word.id === id);
      const target = entries[index + direction];
      if (index >= 0 && target) void saveOrder(id, target.id);
    },
    [entries, saveOrder],
  );
  const measure = useCallback((id: string, height: number) => {
    heights.current.set(id, height);
    const current = drag.current;
    if (current && !current.saving) {
      const index = current.entries.findIndex((word) => word.id === id);
      if (index >= 0) current.spans[index] = height + StyleSheet.hairlineWidth;
    }
  }, []);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scroll.current = event.nativeEvent.contentOffset.y;
      updateDrag();
    },
    [updateDrag],
  );
  const onContentSizeChange = useCallback((_: number, height: number) => {
    contentHeight.current = height;
  }, []);
  const controls = useMemo<ReorderControls>(
    () => ({
      disabled: saving,
      onStart: start,
      onMove: move,
      onEnd: end,
      onCancel: cancel,
      onStep: step,
      onMeasure: measure,
    }),
    [saving, start, move, end, cancel, step, measure],
  );
  const visuals = useMemo(
    () => ({ id: draggingId, offset, shifts, reducedMotion }),
    [draggingId, offset, shifts, reducedMotion],
  );
  return {
    list,
    viewportRef,
    measureViewport,
    onScroll,
    onContentSizeChange,
    draggingId,
    saving,
    cancel,
    controls,
    visuals,
  };
}
