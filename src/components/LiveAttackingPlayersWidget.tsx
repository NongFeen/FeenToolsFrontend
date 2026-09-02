import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "react-router-dom";
import { assetUrl, api } from "../api/client";
import "../styles/live-attacking-players-widget.css";
import type { LiveAttackingPlayer } from "../api/types";

// The row dims (partial opacity) only once its timer has actually hit 0 --
// i.e. only while it's genuinely expiring/held before removal, not as an
// early warning beforehand. This is separate from the full fade+shrink-out
// that plays once it's actually removed.
const EXPIRING_OPACITY = 0.7;
// Once the timer actually hits 0, the row holds in place (still visible,
// dimmed) for this many extra seconds before it's actually removed -- gives
// the "it's done" state a moment to register before it disappears.
const HOLD_AFTER_EXPIRY_SECONDS = 0.5;
const ROW_TRANSITION = { duration: 0.3, ease: "easeInOut" } as const;

function elapsedSeconds(startedAt: string, now: number) {
  return Math.max(0, (now - new Date(startedAt).getTime()) / 1000);
}

function isExpired(player: LiveAttackingPlayer, now: number) {
  return elapsedSeconds(player.started_at, now) >= player.duration_seconds;
}

// A player_code already in the list with the same started_at is the same
// attack we're already displaying -- leave it alone. Only a brand new
// player_code, or the same player starting a genuinely new attack (a fresh
// started_at), counts as new data worth adding. Anything else is a no-op:
// no state update, so React does not re-render for that push at all.
function mergeIncoming(
  prev: LiveAttackingPlayer[],
  incoming: LiveAttackingPlayer[],
  now: number,
) {
  let changed = false;
  const byCode = new Map(prev.map((player) => [player.player_code, player]));
  for (const player of incoming) {
    if (isExpired(player, now)) continue;
    const existing = byCode.get(player.player_code);
    if (!existing || existing.started_at !== player.started_at) {
      byCode.set(player.player_code, player);
      changed = true;
    }
  }
  return changed ? Array.from(byCode.values()) : prev;
}

// Ticks its own 250ms clock so only this small bar re-renders for the smooth
// countdown -- the rest of the widget (badge, card icons, layout) is left
// untouched instead of re-rendering the whole list every quarter second.
function AttackTimer({
  player,
  onExpire,
}: {
  player: LiveAttackingPlayer;
  onExpire: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  // `onExpire` is a fresh closure every parent render (it captures
  // player.player_code), so it can't be a stable effect dependency -- guard
  // with a ref instead, so a re-render after expiry can't re-fire onExpire.
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const rawElapsed = elapsedSeconds(player.started_at, now);
  // Clamped for display -- once the real timer is done, the bar/text stay
  // frozen at "done" through the hold period instead of showing the clock
  // still running past the attack's actual duration.
  const elapsed = Math.min(rawElapsed, player.duration_seconds);

  useEffect(() => {
    if (
      rawElapsed >= player.duration_seconds + HOLD_AFTER_EXPIRY_SECONDS &&
      !hasExpiredRef.current
    ) {
      hasExpiredRef.current = true;
      onExpire();
    }
  }, [rawElapsed, onExpire, player.duration_seconds]);

  const percent =
    player.duration_seconds > 0
      ? (elapsed / player.duration_seconds) * 100
      : 100;
  const isEndingSoon = player.duration_seconds - elapsed <= 5;

  return (
    <span
      className={`live-attacking-players-timer${isEndingSoon ? " is-ending-soon" : ""}`}
      role="img"
      aria-label={`${elapsed.toFixed(0)} of ${player.duration_seconds.toFixed(0)} second attack timer`}
    >
      <span
        className="live-attacking-players-timer-fill"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      />
      <span className="live-attacking-players-timer-value" aria-hidden="true">
        {elapsed.toFixed(0)}s / {player.duration_seconds.toFixed(0)}s
      </span>
    </span>
  );
}

// A single attacker row. AnimatePresence (where this is rendered) plays
// `exit` automatically the moment this is removed from the `players` array
// -- it keeps the element mounted just long enough for the exit animation
// to actually finish, so there's no manual "leaving" flag or removal
// timeout to keep in sync with the CSS. `layout` makes every row smoothly
// reposition (the "push up" effect) whenever a sibling's size changes.
// Height animates to/from the literal value "auto" -- Motion measures the
// real content height internally, which is the robust way to animate a
// variable-height row (plain CSS can't transition to/from `auto` at all).
function AttackerRow({
  player,
  onExpire,
}: {
  player: LiveAttackingPlayer;
  onExpire: () => void;
}) {
  const [dimmed, setDimmed] = useState(
    () =>
      elapsedSeconds(player.started_at, Date.now()) >= player.duration_seconds,
  );

  // One precisely-scheduled timeout for the exact moment this attack's
  // timer hits 0 (i.e. the moment it starts genuinely expiring) -- no
  // polling needed, since that moment is fully determined by started_at +
  // duration_seconds. The "already past that point at mount" case is
  // handled by the lazy initial state above instead of a synchronous
  // setState here.
  useEffect(() => {
    const remainingMs =
      (player.duration_seconds -
        elapsedSeconds(player.started_at, Date.now())) *
      1000;
    if (remainingMs <= 0) return;
    const id = window.setTimeout(() => setDimmed(true), remainingMs);
    return () => window.clearTimeout(id);
  }, [player.started_at, player.duration_seconds]);

  return (
    <motion.div
      // "position" (not the bare boolean, which also tracks width/height)
      // -- height is already explicitly driven by initial/animate/exit
      // below, so layout only needs to handle the Y-position shift caused
      // by siblings being added/removed (the "push up" effect). Tracking
      // width too would animate it if it happens to change for an
      // unrelated reason (e.g. the list's scrollbar appearing/disappearing
      // as content height crosses its threshold), which visibly looks like
      // the row growing/shrinking sideways.
      layout="position"
      initial={{
        opacity: 0,
        height: 0,
        borderBottomColor: "rgba(43, 39, 33, 0)",
      }}
      animate={{
        // While expiring, opacity/height/border all shrink away gradually
        // across the whole HOLD_AFTER_EXPIRY_SECONDS hold window (matching
        // the countdown itself), instead of sitting at full size dimmed
        // and only then snapping into the actual removal animation --
        // by the time AttackTimer's onExpire actually removes this row
        // (also timed off HOLD_AFTER_EXPIRY_SECONDS), it's already
        // collapsed, so the `exit` animation below ends up a no-op.
        opacity: dimmed ? EXPIRING_OPACITY : 1,
        height: dimmed ? 0 : "auto",
        borderBottomColor: dimmed
          ? "rgba(43, 39, 33, 0)"
          : "rgba(43, 39, 33, 0.1)",
      }}
      exit={{
        opacity: 0,
        height: 0,
        borderBottomColor: "rgba(43, 39, 33, 0)",
        // Overrides the component-level `transition` below for this
        // specific animation (removal) -- harmless no-op in practice since
        // the row is already collapsed by the time this fires, but keeps
        // this animation fast rather than inheriting the slow hold-drain
        // duration if it ever fires before the hold-driven shrink finishes.
        transition: ROW_TRANSITION,
      }}
      transition={{
        ...ROW_TRANSITION,
        // Once expiring (but not yet actually being removed), these drain
        // gradually across the whole hold window instead of snapping
        // straight to their collapsed values.
        opacity: dimmed
          ? { duration: HOLD_AFTER_EXPIRY_SECONDS, ease: "linear" }
          : ROW_TRANSITION,
        height: dimmed
          ? { duration: HOLD_AFTER_EXPIRY_SECONDS, ease: "linear" }
          : ROW_TRANSITION,
        borderBottomColor: dimmed
          ? { duration: HOLD_AFTER_EXPIRY_SECONDS, ease: "linear" }
          : ROW_TRANSITION,
      }}
      className="live-attacking-players-entry"
    >
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: dimmed ? 0 : 1 }}
        exit={{ scaleY: 0 }}
        transition={
          dimmed
            ? { duration: HOLD_AFTER_EXPIRY_SECONDS, ease: "linear" }
            : ROW_TRANSITION
        }
        style={{ transformOrigin: "top" }}
        className="live-attacking-players-entry-inner"
      >
        <span className="live-attacking-players-row">
          <span className="live-attacking-players-name">{player.name}</span>
          <span className="live-attacking-players-cards">
            {player.cards.map((card, index) => (
              <span
                className="live-attacking-players-card"
                key={`${player.player_code}-${index}`}
              >
                {card.image_url ? (
                  <img
                    src={assetUrl(card.image_url)}
                    alt={card.display_name}
                    loading="lazy"
                  />
                ) : (
                  <span className="live-attacking-players-card-fallback">
                    {card.display_name}
                  </span>
                )}
              </span>
            ))}
          </span>
        </span>
        <AttackTimer player={player} onExpire={onExpire} />
      </motion.div>
    </motion.div>
  );
}

export default function LiveAttackingPlayersWidget() {
  const { pathname } = useLocation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [suppressOpen, setSuppressOpen] = useState(false);
  const [players, setPlayers] = useState<LiveAttackingPlayer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const isOpen = pinned || (!suppressOpen && (hovered || focused));
  const isTapTitanRoute = pathname.startsWith("/tools/taptitan");

  const applyIncoming = useCallback((incoming: LiveAttackingPlayer[]) => {
    const now = Date.now();
    setPlayers((prev) => mergeIncoming(prev, incoming, now));
  }, []);

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
        applyIncoming(
          JSON.parse(
            (event as MessageEvent<string>).data,
          ) as LiveAttackingPlayer[],
        );
        clearDisconnectWarning();
      } catch {
        // Ignore a malformed snapshot payload; the next one will correct it.
      }
    });

    source.addEventListener("player", (event) => {
      try {
        applyIncoming([
          JSON.parse(
            (event as MessageEvent<string>).data,
          ) as LiveAttackingPlayer,
        ]);
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

  const removePlayer = useCallback((playerCode: string, startedAt: string) => {
    setPlayers((prev) => {
      const next = prev.filter(
        (player) =>
          !(
            player.player_code === playerCode && player.started_at === startedAt
          ),
      );
      return next.length === prev.length ? prev : next;
    });
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
        aria-label={
          pinned
            ? "Close attacking players widget"
            : isOpen
              ? "Pin attacking players widget open"
              : "Open attacking players widget"
        }
      >
        {isOpen && (
          <span className="live-attacking-players-heading">
            <strong>Attacking Now</strong>
            <span className="live-attacking-players-heading-right">
              <span className="live-attacking-players-pin" aria-hidden="true">
                {pinned ? "Pinned" : "Click to pin"}
              </span>
            </span>
          </span>
        )}
        {isOpen ? (
          <span className="live-attacking-players-list">
            {message && (
              <span className="live-attacking-players-status is-error">
                {message}
              </span>
            )}
            {/* Default (sync) mode, not popLayout: popLayout pulls an
                exiting row out of layout flow immediately, so siblings snap
                to their final position right away while the exiting row
                keeps animating separately in its old spot -- sync keeps it
                in flow so siblings reflow gradually, in step with its own
                shrink, which is the "push up as it shrinks" effect wanted
                here. */}
            <AnimatePresence>
              {players.map((player) => (
                <AttackerRow
                  key={`${player.player_code}:${player.started_at}`}
                  player={player}
                  onExpire={() =>
                    removePlayer(player.player_code, player.started_at)
                  }
                />
              ))}
            </AnimatePresence>
          </span>
        ) : (
          <span className="live-attacking-players-badge">{players.length}</span>
        )}
      </button>
    </aside>
  );
}
