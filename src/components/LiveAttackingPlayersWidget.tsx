import { useCallback, useEffect, useState } from "react";
import type { FocusEvent } from "react";
import { useLocation } from "react-router-dom";
import { assetUrl, api } from "../api/client";
import "../styles/live-attacking-players-widget.css";
import type { LiveAttackingPlayer } from "../api/types";

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
// no state update, so React does not re-render for that poll at all.
function mergeIncoming(prev: LiveAttackingPlayer[], incoming: LiveAttackingPlayer[], now: number) {
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
function AttackTimer({ player, onExpire }: { player: LiveAttackingPlayer; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.min(elapsedSeconds(player.started_at, now), player.duration_seconds);

  useEffect(() => {
    if (elapsed >= player.duration_seconds) onExpire();
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
  const [players, setPlayers] = useState<LiveAttackingPlayer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const isOpen = pinned || (!suppressOpen && (hovered || focused));
  const isTapTitanRoute = pathname.startsWith("/tools/taptitan");

  // Polls for the current attacker list and adds anything genuinely new
  // (new player_code, or the same player starting a fresh attack). Already-
  // known entries are left completely untouched -- no state update at all
  // when a poll turns up nothing new, so there's nothing to re-render.
  useEffect(() => {
    if (!isTapTitanRoute) return;
    let cancelled = false;

    const fetchPlayers = async () => {
      try {
        const incoming = await api.liveAttackingPlayers();
        if (cancelled) return;
        const now = Date.now();
        setPlayers((prev) => mergeIncoming(prev, incoming, now));
        setMessage(null);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Could not refresh attacking players.");
        }
      }
    };

    void fetchPlayers();
    const id = setInterval(() => void fetchPlayers(), 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isTapTitanRoute]);

  const removePlayer = useCallback((playerCode: string) => {
    setPlayers((prev) => prev.filter((player) => player.player_code !== playerCode));
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
            {!message && players.length === 0 && (
              <span className="live-attacking-players-status">No one is attacking right now.</span>
            )}
            {players.map((player) => (
              <span className="live-attacking-players-entry" key={player.player_code}>
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
            ))}
          </span>
        ) : (
          <span className="live-attacking-players-badge">{players.length}</span>
        )}
      </button>
    </aside>
  );
}
