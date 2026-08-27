import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import "../styles/live-boss-widget.css";
import type {
  BossPartName,
  LiveBossDisplayPart,
  LiveCurrentBoss,
} from "../api/types";

const BOSS_IMAGE = "/assets/taptitan/bosses/Raid_Boss_Prikers.png";
const MIN_WIDGET_WIDTH = 240;
const MAX_WIDGET_WIDTH = 520;

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
  const partLabel = PART_LABELS[part.part_name];
  if (!part.is_targeted) {
    return (
      <span
        className={`live-boss-widget-untargeted live-boss-widget-bar-${PART_CLASSES[part.part_name]}`}
        role="img"
        aria-label={`${partLabel} is not targeted`}
      >
        X
      </span>
    );
  }
  if (part.part_state === "Skeleton") return null;
  const percent = part.max_hp > 0
    ? Math.min(100, Math.max(0, (part.current_hp / part.max_hp) * 100))
    : 0;

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
  const [message, setMessage] = useState<string | null>(null);
  const [widgetWidth, setWidgetWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const widgetRef = useRef<HTMLElement | null>(null);
  const resizeStart = useRef<{ pointerX: number; width: number } | null>(null);
  const resizeFrame = useRef<number | null>(null);
  const pendingResizeWidth = useRef<number | null>(null);
  const isOpen = pinned || (!suppressOpen && (hovered || focused));
  const isTapTitanRoute = pathname.startsWith("/tools/taptitan");

  // The backend pushes the live boss over SSE (a "boss" event right when the
  // connection opens, then again each time a raid event that could change it
  // has been processed) instead of the widget polling for it every few
  // seconds. Only open a connection while the panel is actually visible --
  // no point holding a stream for a collapsed widget nobody's looking at.
  useEffect(() => {
    if (!isOpen) return;

    const source = new EventSource(api.liveCurrentBossStreamUrl());

    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const clearDisconnectWarning = () => {
      if (disconnectTimer !== null) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
      setMessage(null);
    };

    source.addEventListener("boss", (event) => {
      const raw = (event as MessageEvent<string>).data;
      try {
        const nextBoss = raw === "null" ? null : (JSON.parse(raw) as LiveCurrentBoss);
        clearDisconnectWarning();
        if (nextBoss === null) {
          setBoss(null);
          setMessage("Waiting for the next attack event.");
          return;
        }
        setBoss((prev) =>
          !nextBoss.display_parts && prev?.raid_id === nextBoss.raid_id && prev?.display_parts
            ? { ...nextBoss, display_parts: prev.display_parts }
            : nextBoss,
        );
      } catch {
        // Ignore a malformed payload; the next push will correct it.
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
  }, [isOpen]);

  useEffect(() => () => {
    if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
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

  const clampWidgetWidth = (width: number) =>
    Math.min(MAX_WIDGET_WIDTH, Math.max(MIN_WIDGET_WIDTH, Math.min(width, window.innerWidth - 24)));

  const handleResizeStart = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStart.current = {
      pointerX: event.clientX,
      width: event.currentTarget.parentElement?.getBoundingClientRect().width ?? MIN_WIDGET_WIDTH,
    };
    pendingResizeWidth.current = resizeStart.current.width;
    setIsResizing(true);
  };

  const handleResizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeStart.current) return;
    const nextWidth = resizeStart.current.width + resizeStart.current.pointerX - event.clientX;
    pendingResizeWidth.current = clampWidgetWidth(nextWidth);
    if (resizeFrame.current !== null) return;
    resizeFrame.current = requestAnimationFrame(() => {
      if (widgetRef.current && pendingResizeWidth.current !== null) {
        widgetRef.current.style.width = `min(${pendingResizeWidth.current}px, calc(100vw - 24px))`;
      }
      resizeFrame.current = null;
    });
  };

  const handleResizeEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (resizeFrame.current !== null) {
      cancelAnimationFrame(resizeFrame.current);
      resizeFrame.current = null;
    }
    if (pendingResizeWidth.current !== null) {
      setWidgetWidth(pendingResizeWidth.current);
    }
    pendingResizeWidth.current = null;
    resizeStart.current = null;
    setIsResizing(false);
  };

  const handleResizeKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const change = event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? 20
      : event.key === "ArrowRight" || event.key === "ArrowDown"
        ? -20
        : 0;
    if (!change) return;
    event.preventDefault();
    const currentWidth = event.currentTarget.parentElement?.getBoundingClientRect().width
      ?? MIN_WIDGET_WIDTH;
    setWidgetWidth(clampWidgetWidth(currentWidth + change));
  };

  const statusMessage = message
    ?? (boss && !boss.display_parts
      ? "Waiting for matching sub-cycle boss data."
      : null);
  const bossDescription = isOpen && boss?.display_parts
    ? boss.display_parts
      .map((part) => part.is_targeted
        ? `${PART_LABELS[part.part_name]} targeted, ${part.part_state}, ${formatHp(part.current_hp)} of ${formatHp(part.max_hp)} health`
        : `${PART_LABELS[part.part_name]} not targeted`)
      .join("; ")
    : "";

  return (
    <aside
      ref={widgetRef}
      className={`live-boss-widget${isOpen ? " is-open" : ""}${pinned ? " is-pinned" : ""}${isResizing ? " is-resizing" : ""}`}
      style={isOpen && widgetWidth
        ? { width: `min(${widgetWidth}px, calc(100vw - 24px))` }
        : undefined}
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
        {isOpen && statusMessage && (
          <span className={`live-boss-widget-status${message ? " is-error" : ""}`}>
            {statusMessage}
          </span>
        )}
      </button>
      {isOpen && (
        <button
          className="live-boss-widget-resize-handle"
          type="button"
          aria-label="Resize live boss widget. Use arrow keys or drag."
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          onKeyDown={handleResizeKey}
        />
      )}
    </aside>
  );
}
