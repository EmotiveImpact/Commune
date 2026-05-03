import { useEffect, useRef, useState } from 'react';

type DeferredWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

interface UseDeferredSectionOptions {
  enabled?: boolean;
  idleTimeoutMs?: number;
  rootMargin?: string;
  revealOnIdle?: boolean;
}

export function useDeferredSection({
  enabled = true,
  idleTimeoutMs = 250,
  rootMargin = '160px',
  revealOnIdle = true,
}: UseDeferredSectionOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      return;
    }

    if (ready || typeof window === 'undefined') {
      return;
    }

    const reveal = () => {
      setReady(true);
    };

    let disposed = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    let observer: IntersectionObserver | undefined;

    const cleanup = () => {
      if (disposed) return;
      disposed = true;

      if (observer) {
        observer.disconnect();
      }

      if (typeof window !== 'undefined') {
        const idleWindow = window as DeferredWindow;
        if (idleHandle != null && idleWindow.cancelIdleCallback) {
          idleWindow.cancelIdleCallback(idleHandle);
        }
      }

      if (timeoutHandle != null) {
        window.clearTimeout(timeoutHandle);
      }
    };

    const node = ref.current;
    if (!node) {
      timeoutHandle = window.setTimeout(reveal, 0);
      return cleanup;
    }

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            reveal();
          }
        },
        { rootMargin },
      );

      observer.observe(node);
    }

    if (revealOnIdle) {
      const idleWindow = window as DeferredWindow;
      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => {
          reveal();
        }, { timeout: idleTimeoutMs });
      } else {
        timeoutHandle = window.setTimeout(reveal, idleTimeoutMs);
      }
    }

    return cleanup;
  }, [enabled, idleTimeoutMs, ready, revealOnIdle, rootMargin]);

  return { ref, ready };
}
