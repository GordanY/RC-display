import { useEffect, useRef } from 'react';

export function useIdleTimeout(onIdle: () => void, ms: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const reset = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onIdle, ms);
    };

    reset();

    const events = ['touchstart', 'touchmove', 'mousedown', 'mousemove'] as const;
    events.forEach(e => window.addEventListener(e, reset));

    return () => {
      clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [onIdle, ms]);
}
