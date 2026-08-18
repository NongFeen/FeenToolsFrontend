import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FocusEvent } from "react";
import { useLocation } from "react-router-dom";
import { ApiError, api } from "../api/client";
import "../styles/live-boss-widget.css";
import type {
  BossPartName,
  LiveBossDisplayPart,
  LiveCurrentBoss,
} from "../api/types";

const BOSS_IMAGE = "/assets/taptitan/bosses/Raid_Boss_Prikers.png";

const PART_LABELS: Record<BossPartName, string> = {
  Head: "Head",
  Torso: "Torso",
  LeftShoulder: "Left shoulder",
  RightShoulder: "Right shoulder",
  LeftHand: "Left hand",
  RightHand: "Right hand",
  LeftLeg: "Left leg",
  RightLeg: "Right leg",
};

const PART_CLASSES: Record<BossPartName, string> = {
  Head: "head",
  Torso: "torso",
  LeftShoulder: "left-shoulder",
  RightShoulder: "right-shoulder",
  LeftHand: "left-hand",
  RightHand: "right-hand",
  LeftLeg: "left-leg",
  RightLeg: "right-leg",
};

const formatHp = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);

function HealthBar({ part }: { part: LiveBossDisplayPart }) {
  if (part.part_state === "Skeleton") return null;
  const percent = part.max_hp > 0
    ? Math.min(100, Math.max(0, (part.current_hp / part.max_hp) * 100))
    : 0;
  const partLabel = PART_LABELS[part.part_name];

  return (
    <span
      className={`live-boss-widget-bar live-boss-widget-bar-${PART_CLASSES[part.part_name]} is-${part.part_state.toLowerCase()}`}
      role="img"
      aria-label={`${partLabel}, ${part.part_state}, ${formatHp(part.current_hp)} of ${formatHp(part.max_hp)} health`}
      style={{ "--boss-health": `${percent}%` } as CSSProperties}
    >
      <span className="live-boss-widget-bar-fill" aria-hidden="true" />
      <span className="live-boss-widget-bar-value" aria-hidden="true">
        {formatHp(part.current_hp)}
      </span>
    </span>
  );
}

export default function LiveBossWidget() {
  const { pathname } = useLocation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [suppressOpen, setSuppressOpen] = useState(false);
  const [boss, setBoss] = useState<LiveCurrentBoss | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const wasOpen = useRef(false);
  const isOpen = pinned || (!suppressOpen && (hovered || focused));
  const isTapTitanRoute = pathname.startsWith("/tools/taptitan");

  const refreshBoss = useCallback(async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      const nextBoss = await api.liveCurrentBoss();
      setBoss(nextBoss);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setBoss(null);
        setMessage("Waiting for the next attack event.");
      } else {
        setMessage(error instanceof Error ? error.message : "Could not refresh the current boss.");
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !wasOpen.current) void refreshBoss();
    wasOpen.current = isOpen;
  }, [isOpen, refreshBoss]);

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

  const statusMessage = message
    ?? (boss && !boss.display_parts
      ? "Waiting for matching sub-cycle boss data."
      : null);
  const bossDescription = isOpen && boss?.display_parts
    ? boss.display_parts
      .map((part) => `${PART_LABELS[part.part_name]} ${part.part_state}, ${formatHp(part.current_hp)} of ${formatHp(part.max_hp)} health`)
      .join("; ")
    : "";

  return (
    <aside
      className={`live-boss-widget${isOpen ? " is-open" : ""}${pinned ? " is-pinned" : ""}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={handleBlur}
      aria-label="Live Tap Titan boss"
    >
      <button
        className="live-boss-widget-button"
        type="button"
        onClick={handleClick}
        aria-expanded={isOpen}
        aria-pressed={pinned}
        aria-label={`${pinned ? "Close live boss widget" : isOpen ? "Pin live boss widget open" : "Open live boss widget"}${bossDescription ? `. ${bossDescription}` : ""}`}
      >
        {isOpen && (
          <span className="live-boss-widget-heading">
            <span>
              <strong>Current Boss</strong>
              {boss && <small>{boss.boss_data.enemy_id} - Titan {boss.titan_index}</small>}
            </span>
            <span className="live-boss-widget-pin" aria-hidden="true">
              {pinned ? "Pinned" : "Click to pin"}
            </span>
          </span>
        )}
        <span className="live-boss-widget-stage">
          <img src={BOSS_IMAGE} alt="" draggable="false" />
          {isOpen && boss?.display_parts?.map((part) => (
            <HealthBar key={part.part_name} part={part} />
          ))}
          {!isOpen && <span className="live-boss-widget-collapsed-label">Boss</span>}
        </span>
        {isOpen && (refreshing || statusMessage) && (
          <span className={`live-boss-widget-status${message ? " is-error" : ""}`}>
            {refreshing ? "Refreshing current boss..." : statusMessage}
          </span>
        )}
      </button>
    </aside>
  );
}
