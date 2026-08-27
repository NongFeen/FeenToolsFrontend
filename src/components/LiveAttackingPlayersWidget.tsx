import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { useLocation } from "react-router-dom";
import { assetUrl, api } from "../api/client";
import "../styles/live-attacking-players-widget.css";
import type { LiveAttackingPlayer } from "../api/types";

// Must match the `--entry-transition` duration in
// live-attacking-players-widget.css, so an entry is only dropped from state
// once its fade+shrink-out animation has actually finished playing.
const ENTRY_EXIT_MS = 320;

type EntryPhase = "entering" | "idle" | "leaving";

interface PlayerEntry {
  player: LiveAttackingPlayer;
  phase: EntryPhase;
}

function elapsedSeconds(startedAt: string, now: number) {
  return Math.max(0, (now - new Date(startedAt).getTime()) / 1000);
}

function isExpired(player: LiveAttackingPlayer, now: number) {
  return elapsedSeconds(player.started_at, now) >= player.duration_seconds;
}

// A player_code already in the list with the same started_at is the same
// attack we're already displaying -- leave it alone. Only a brand new
// player_code, or the same player starting a genuinely new attack (a fresh
// started_at), counts as new data worth adding, and is marked "entering" so
// it fades+grows in instead of popping into the list. Anything else is a
// no-op: no state update, so React does not re-render at all.
function mergeIncoming(prev: PlayerEntry[], incoming: LiveAttackingPlayer[], now: number) {
  let changed = false;
  const byCode = new Map(prev.map((entry) => [entry.player.player_code, entry]));
  for (const player of incoming) {
    if (isExpired(player, now)) continue;
    const existing = byCode.get(player.player_code);
    if (!existing || existing.player.started_at !== player.started_at) {
      byCode.set(player.player_code, { player, phase: "entering" });
      changed = true;
    }
  }
  return changed ? Array.from(byCode.values()) : prev;
}

// Ticks its own 250ms clock so only this small bar re-renders for the smooth
// countdown -- the rest of the widget (badge, card icons, layout) is left
// untouched instead of re-rendering the whole list every quarter second.
function AttackTimer({ player, onExpire }: { player: LiveAttackingPlayer; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  // `onExpire` is a fresh closure every parent render (it captures
  // player.player_code), so it can't be a stable effect dependency -- guard
  // with a ref instead, so a re-render after expiry (e.g. while the "leaving"
  // fade plays) can't re-fire onExpire and loop back into another render.
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.min(elapsedSeconds(player.started_at, now), player.duration_seconds);

  useEffect(() => {
    if (elapsed >= player.duration_seconds && !hasExpiredRef.current) {
      hasExpiredRef.current = true;
      onExpire();
    }
  }, [elapsed, onExpire, player.duration_seconds]);

  const percent = player.duration_seconds > 0 ? (elapsed / player.duration_seconds) * 100 : 100;
  const isEndingSoon = player.duration_seconds - elapsed <= 5;

  return (
    <span
      className={`live-attacking-players-timer${isEndingSoon ? " is-ending-soon" : ""}`}
      role="img"
      aria-label={`${elapsed.toFixed(0)} of ${player.duration_seconds.toFixed(0)} second attack timer`}
    >
      <span className="live-attacking-players-timer-fill" style={{ width: `${percent}%` }} aria-hidden="true" />
      <span className="live-attacking-players-timer-value" aria-hidden="true">
        {elapsed.toFixed(0)}s / {player.duration_seconds.toFixed(0)}s
      </span>
    </span>
  );
}

export default function LiveAttackingPlayersWidget() {
  const { pathname } = useLocation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [suppressOpen, setSuppressOpen] = useState(false);
  const [entries, setEntries] = useState<PlayerEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const isOpen = pinned || (!suppressOpen && (hovered || focused));
  const isTapTitanRoute = pathname.startsWith("/tools/taptitan");
  const activeCount = entries.reduce((count, entry) => (entry.phase === "leaving" ? count : count + 1), 0);

  const applyIncoming = useCallback((incoming: LiveAttackingPlayer[]) => {
    const now = Date.now();
    setEntries((prev) => mergeIncoming(prev, incoming, now));
  }, []);

  // Flips freshly-added entries from "entering" to "idle" a couple of frames
  // after they've actually been committed and painted, so the CSS
  // transition has a real "before" state (collapsed/transparent) to animate
  // away from instead of racing the initial paint. This has to live in an
  // effect -- doing it from inside the setEntries updater itself (as an
  // earlier version did) runs the rAF scheduling during React's render
  // phase, before there's any guarantee the DOM has actually committed yet.
  useEffect(() => {
    if (!entries.some((entry) => entry.phase === "entering")) return;
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        setEntries((prev) => {
          let changed = false;
          const next = prev.map((entry) => {
            if (entry.phase === "entering") {
              changed = true;
              return { ...entry, phase: "idle" as const };
            }
            return entry;
          });
          return changed ? next : prev;
        });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [entries]);

  // The backend pushes updates over SSE (a "snapshot" event right when the
  // connection opens, then a "player" event for each new attack as it
  // starts) instead of the widget having to poll for them. EventSource
  // reconnects on its own after a drop; the fresh "snapshot" it gets on
  // reconnect self-heals anything missed while disconnected.
  useEffect(() => {
    if (!isTapTitanRoute) return;

    const source = new EventSource(api.liveAttackingPlayersStreamUrl());

    // A dropped connection retries almost instantly in practice, so only
    // surface the "disconnected" banner if it's still down after a short
    // grace period -- otherwise a brief blip would flash the error status
    // in and back out, reading as the whole widget flickering.
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const clearDisconnectWarning = () => {
      if (disconnectTimer !== null) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      setMessage(null);
    };

    source.addEventListener("snapshot", (event) => {
      try {
        applyIncoming(JSON.parse((event as MessageEvent<string>).data) as LiveAttackingPlayer[]);
        clearDisconnectWarning();
      } catch {
        // Ignore a malformed snapshot payload; the next one will correct it.
      }
    });

    source.addEventListener("player", (event) => {
      try {
        applyIncoming([JSON.parse((event as MessageEvent<string>).data) as LiveAttackingPlayer]);
        clearDisconnectWarning();
      } catch {
        // Ignore a malformed player payload; the next update will correct it.
      }
    });

    source.onopen = clearDisconnectWarning;

    source.onerror = () => {
      if (disconnectTimer !== null) return;
      disconnectTimer = setTimeout(() => {
        disconnectTimer = null;
        setMessage("Live updates disconnected; reconnecting...");
      }, 1500);
    };

    return () => {
      if (disconnectTimer !== null) clearTimeout(disconnectTimer);
      source.close();
    };
  }, [isTapTitanRoute, applyIncoming]);

  const removePlayer = useCallback((playerCode: string) => {
    setEntries((prev) => {
      const index = prev.findIndex((entry) => entry.player.player_code === playerCode);
      if (index === -1 || prev[index].phase === "leaving") return prev;
      const next = prev.slice();
      next[index] = { ...prev[index], phase: "leaving" };
      return next;
    });
    window.setTimeout(() => {
      setEntries((prev) => {
        const next = prev.filter((entry) => !(entry.player.player_code === playerCode && entry.phase === "leaving"));
        return next.length === prev.length ? prev : next;
      });
    }, ENTRY_EXIT_MS);
  }, []);

  if (!isTapTitanRoute) return null;

  const handleClick = () => {
    setPinned((current) => {
      if (current) {
        setSuppressOpen(true);
        setFocused(false);
        return false;
      }
      return true;
    });
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setSuppressOpen(false);
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocused(false);
      if (!hovered) setSuppressOpen(false);
    }
  };

  return (
    <aside
      className={`live-attacking-players-widget${isOpen ? " is-open" : ""}${pinned ? " is-pinned" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={handleBlur}
      aria-label="Live Tap Titan attacking players"
    >
      <button
        className="live-attacking-players-button"
        type="button"
        onClick={handleClick}
        aria-expanded={isOpen}
        aria-pressed={pinned}
        aria-label={pinned ? "Close attacking players widget" : isOpen ? "Pin attacking players widget open" : "Open attacking players widget"}
      >
        {isOpen && (
          <span className="live-attacking-players-heading">
            <strong>Attacking Now</strong>
            <span className="live-attacking-players-pin" aria-hidden="true">
              {pinned ? "Pinned" : "Click to pin"}
            </span>
          </span>
        )}
        {isOpen ? (
          <span className="live-attacking-players-list">
            {message && <span className="live-attacking-players-status is-error">{message}</span>}
            {!message && activeCount === 0 && (
              <span className="live-attacking-players-status">No one is attacking right now.</span>
            )}
            {entries.map(({ player, phase }) => (
              <span
                className={`live-attacking-players-entry${phase === "idle" ? "" : ` is-${phase}`}`}
                key={player.player_code}
              >
                <span className="live-attacking-players-entry-inner">
                  <span className="live-attacking-players-row">
                    <span className="live-attacking-players-name">{player.name}</span>
                    <span className="live-attacking-players-cards">
                      {player.cards.map((card, index) => (
                        <span className="live-attacking-players-card" key={`${player.player_code}-${index}`}>
                          {card.image_url ? (
                            <img src={assetUrl(card.image_url)} alt={card.display_name} loading="lazy" />
                          ) : (
                            <span className="live-attacking-players-card-fallback">{card.display_name}</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </span>
                  <AttackTimer player={player} onExpire={() => removePlayer(player.player_code)} />
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="live-attacking-players-badge">{activeCount}</span>
        )}
      </button>
    </aside>
  );
}
