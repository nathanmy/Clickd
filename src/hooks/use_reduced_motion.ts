import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    let disposed = false;
    let receivedEvent = false;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        receivedEvent = true;
        if (!disposed) setEnabled(value);
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!disposed && !receivedEvent) setEnabled(value);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);
  return enabled;
}
