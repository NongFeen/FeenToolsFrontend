import { useEffect, useRef } from "react";

interface PollingOptions<T> {
  enabled: boolean;
  intervalMs?: number;
  load: () => Promise<T>;
  onData: (data: T) => void;
  onError?: (error: unknown) => void;
}

export function usePolling<T>({
  enabled,
  intervalMs = 2000,
  load,
  onData,
  onError,
}: PollingOptions<T>) {
  const loadRef = useRef(load);
  const dataRef = useRef(onData);
  const errorRef = useRef(onError);

  useEffect(() => {
    loadRef.current = load;
    dataRef.current = onData;
    errorRef.current = onError;
  });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await loadRef.current();
        if (active) dataRef.current(data);
      } catch (error) {
        if (active) errorRef.current?.(error);
      } finally {
        if (active) timer = setTimeout(tick, intervalMs);
      }
    };

    void tick();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, intervalMs]);
}
