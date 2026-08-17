import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { api } from "../api/client";
import { usePolling } from "./usePolling";

export function useRaidMoraleDefault(
  setMoralePercent: Dispatch<SetStateAction<number>>,
) {
  const manuallyEditedRef = useRef(false);

  usePolling({
    enabled: true,
    intervalMs: 60_000,
    load: api.currentRaidCycle,
    onData: (cycle) => {
      if (!manuallyEditedRef.current) {
        setMoralePercent(
          Math.min(100, Math.max(0, cycle.default_morale_percent)),
        );
      }
    },
  });

  return useCallback(
    (value: number) => {
      manuallyEditedRef.current = true;
      setMoralePercent(value);
    },
    [setMoralePercent],
  );
}
