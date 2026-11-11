import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import type { Message } from '@/state/types';

type MessageSnapshot = Readonly<{
  conversationId: string | null;
  ids: ReadonlySet<string>;
  newestAt: number | null;
}>;

const NEAR_BOTTOM_PX = 80;

/** Follow new messages while preserving the reader's position in history. */
export function useMessageScroll(
  conversationMessages: readonly Message[],
  activeConversationId: string | null,
  currentUserId: string,
) {
  const list = useRef<FlatList<Message>>(null);
  const nearBottom = useRef(true);

  const pendingScroll = useRef<{
    animated: boolean;
    messages: readonly Message[];
  } | null>(null);

  const measuredMessages = useRef<readonly Message[] | null>(null);

  const previous = useRef<MessageSnapshot>({
    conversationId: null,
    ids: new Set(),
    newestAt: null,
  });

  const [newMessageCount, setNewMessageCount] = useState(0);

  const showLatest = useCallback((animated: boolean) => {
    pendingScroll.current = null;
    nearBottom.current = true;
    setNewMessageCount(0);

    list.current?.scrollToEnd({ animated });
  }, []);

  const flushPendingScroll = useCallback(
    (measured: readonly Message[]) => {
      const request = pendingScroll.current;

      if (
        request !== null &&
        request.messages === measured &&
        list.current !== null
      ) {
        showLatest(request.animated);
      }
    },
    [showLatest],
  );

  // Content measurements can arrive before or after this effect.
  // Follow messages only after their current layout is measured.
  useLayoutEffect(() => {
    const conversationChanged =
      previous.current.conversationId !== activeConversationId;
    const newestAt = previous.current.newestAt;
    const arrivals = conversationMessages.filter(
      (message) =>
        !previous.current.ids.has(message.id) &&
        (newestAt === null || Date.parse(message.createdAt) >= newestAt),
    );
    const followNewMessages =
      arrivals.length > 0 &&
      (nearBottom.current ||
        arrivals.some((message) => message.senderId === currentUserId));
    const latest = conversationMessages.at(-1);
    previous.current = {
      conversationId: activeConversationId,
      ids: new Set(conversationMessages.map((message) => message.id)),
      newestAt: latest ? Date.parse(latest.createdAt) : null,
    };

    if (conversationChanged || followNewMessages) {
      if (conversationChanged) nearBottom.current = true;
      pendingScroll.current = {
        animated: !conversationChanged,
        messages: conversationMessages,
      };
      setNewMessageCount(0);
    } else if (arrivals.length > 0) {
      setNewMessageCount((count) => count + arrivals.length);
    } else if (pendingScroll.current !== null) {
      // Changes to other conversations can recreate this list before measurement.
      pendingScroll.current.messages = conversationMessages;
    }

    if (measuredMessages.current === conversationMessages) {
      flushPendingScroll(conversationMessages);
    }
  }, [
    activeConversationId,
    conversationMessages,
    currentUserId,
    flushPendingScroll,
  ]);

  const onContentSizeChange = useCallback(() => {
    measuredMessages.current = conversationMessages;
    flushPendingScroll(conversationMessages);
  }, [conversationMessages, flushPendingScroll]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;

      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;

      nearBottom.current = distanceFromBottom <= NEAR_BOTTOM_PX;

      if (nearBottom.current) {
        setNewMessageCount(0);
      } else {
        // Manual scrolling takes priority over a queued
        // automatic scroll.
        pendingScroll.current = null;
      }
    },
    [],
  );

  return { list, newMessageCount, showLatest, onContentSizeChange, onScroll };
}
