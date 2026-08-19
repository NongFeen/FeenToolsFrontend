import { useEffect, useMemo, useState } from "react";
import type { RaidCycle } from "../api/types";

const RESET_INTERVAL_MS = 12 * 60 * 60 * 1_000;

const upcomingReset = (cycle: RaidCycle, now: number) => {
  const reported = Date.parse(cycle.next_reset_at);
  if (Number.isFinite(reported) && reported > now) return reported;

  const raidStarted = Date.parse(cycle.raid_started_at);
  if (!Number.isFinite(raidStarted)) return reported;
  const elapsed = Math.max(0, now - raidStarted);
  return raidStarted + (Math.floor(elapsed / RESET_INTERVAL_MS) + 1) * RESET_INTERVAL_MS;
};

const formatRemaining = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
};

interface RaidResetCountdownProps {
  cycle: RaidCycle | null;
  loading: boolean;
}

export default function RaidResetCountdown({ cycle, loading }: RaidResetCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cycle) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [cycle]);

  const resetAt = useMemo(() => cycle ? upcomingReset(cycle, now) : null, [cycle, now]);
  const hasResetTime = resetAt !== null && Number.isFinite(resetAt);

  return (
    <section className="raid-reset-card" aria-label="Raid reset time">
      <div>
        <span>Next reset</span>
        <strong>
          {loading
            ? "Loading…"
            : hasResetTime
              ? new Date(resetAt).toLocaleString()
              : "Unavailable"}
        </strong>
      </div>
      <div>
        <span>Countdown</span>
        <strong className="raid-reset-countdown" role="timer" aria-live="off">
          {loading
            ? "--:--:--"
            : hasResetTime
              ? formatRemaining(resetAt - now)
              : "--:--:--"}
        </strong>
      </div>
    </section>
  );
}
