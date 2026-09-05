import { useState } from "react";
import { assetUrl, cardImagePath } from "../api/client";
import type { CardDefinition, PlayerCard } from "../api/types";

const normalizeCardKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

// Fixed display order for the known card types; anything else (shouldn't
// happen, but a card definition could be missing) falls into "Other" last.
const CARD_TYPE_ORDER = ["Burst", "Affliction", "Support"];

function groupByType(playerCards: PlayerCard[], definitions: Map<string, CardDefinition>) {
  const groups = new Map<string, PlayerCard[]>();
  for (const card of playerCards) {
    const type = definitions.get(normalizeCardKey(card.card_id))?.type ?? "Other";
    const group = groups.get(type);
    if (group) group.push(card);
    else groups.set(type, [card]);
  }
  const orderedTypes = [
    ...CARD_TYPE_ORDER.filter((type) => groups.has(type)),
    ...[...groups.keys()].filter((type) => !CARD_TYPE_ORDER.includes(type)),
  ];
  return orderedTypes.map((type) => ({ type, cards: groups.get(type) ?? [] }));
}

interface Props {
  onClose: () => void;
  onSubmit: (params: {
    deckCount: number;
    excludedCards: string[];
    mustIncludeMirrorForce: boolean;
    mustIncludeTeamTactics: boolean;
  }) => Promise<void> | void;
  playerCards: PlayerCard[];
  cards: CardDefinition[];
  deckCountOptions: number[];
  initialDeckCount: number;
  initialMustIncludeMirrorForce: boolean;
  initialMustIncludeTeamTactics: boolean;
  submitting: boolean;
  error: string;
}

// The parent only mounts this component while the popup is open (see
// `rerecommendOpen && <ReRecommendModal ... />` in PlayerRecommendations),
// so `useState` below already starts fresh -- every "closed" is really an
// unmount, so there's never stale selection state to reset on next open.
export default function ReRecommendModal({
  onClose,
  onSubmit,
  playerCards,
  cards,
  deckCountOptions,
  initialDeckCount,
  initialMustIncludeMirrorForce,
  initialMustIncludeTeamTactics,
  submitting,
  error,
}: Props) {
  const [excludedCards, setExcludedCards] = useState<Set<string>>(new Set());
  const [deckCount, setDeckCount] = useState(initialDeckCount);
  const [mustIncludeMirrorForce, setMustIncludeMirrorForce] = useState(initialMustIncludeMirrorForce);
  const [mustIncludeTeamTactics, setMustIncludeTeamTactics] = useState(initialMustIncludeTeamTactics);

  const definitions = new Map(cards.map((card) => [normalizeCardKey(card.id), card] as const));
  const cardGroups = groupByType(playerCards, definitions);

  const toggleCard = (cardId: string) => {
    setExcludedCards((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  return (
    <div className="rerecommend-overlay" role="dialog" aria-modal="true" aria-label="Re-recommend decks">
      <div className="rerecommend-modal panel">
        <div className="panel-heading-row">
          <div>
            <h2 className="panel-title">Re-recommend decks</h2>
            <p className="panel-desc">
              Click a card to exclude it (e.g. already used this cycle and can't be reused). Green cards stay
              available, red cards are left out of every deck below.
            </p>
          </div>
          <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
            Close
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {cardGroups.map(({ type, cards: groupCards }) => (
          <div className="rerecommend-card-group" key={type}>
            <h3 className="rerecommend-card-group-title">{type}</h3>
            <div className="rerecommend-card-grid">
              {groupCards.map((card) => {
                const definition = definitions.get(normalizeCardKey(card.card_id));
                const readableId = card.card_id.replace(/([A-Z])/g, " $1").trim();
                const displayName = definition?.name ?? readableId;
                const excluded = excludedCards.has(card.card_id);
                return (
                  <button
                    type="button"
                    key={card.card_id}
                    className={`rerecommend-card${excluded ? " rerecommend-card-excluded" : " rerecommend-card-included"}`}
                    onClick={() => toggleCard(card.card_id)}
                    disabled={submitting}
                    aria-pressed={!excluded}
                    title={excluded ? `${displayName} (excluded)` : `${displayName} (available)`}
                  >
                    <span className="card-art-wrap">
                      {definition ? (
                        <img src={assetUrl(cardImagePath(card.card_id))} alt={`${displayName} raid card`} loading="lazy" />
                      ) : (
                        <span
                          className="deck-image-missing"
                          role="img"
                          aria-label={`${displayName} image unavailable`}
                        >
                          Image unavailable
                        </span>
                      )}
                    </span>
                    <small>{displayName}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rerecommend-footer">
          <div className="rerecommend-footer-controls">
            <label className="required-cards-toggle">
              <input
                type="checkbox"
                checked={mustIncludeMirrorForce}
                onChange={(event) => setMustIncludeMirrorForce(event.target.checked)}
                disabled={submitting}
              />
              <span>Must include Mirror Force</span>
            </label>
            <label className="required-cards-toggle">
              <input
                type="checkbox"
                checked={mustIncludeTeamTactics}
                onChange={(event) => setMustIncludeTeamTactics(event.target.checked)}
                disabled={submitting}
              />
              <span>Must include Team Tactics</span>
            </label>
            <label className="deck-count-control">
              <span>Number of decks</span>
              <select value={deckCount} onChange={(event) => setDeckCount(Number(event.target.value))}>
                {deckCountOptions.map((count) => (
                  <option key={count} value={count}>
                    Best {count} {count === 1 ? "deck" : "decks"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="calc-btn"
            disabled={submitting}
            onClick={() =>
              void onSubmit({
                deckCount,
                excludedCards: [...excludedCards],
                mustIncludeMirrorForce,
                mustIncludeTeamTactics,
              })
            }
          >
            {submitting ? "Re-recommending…" : "Re-recommend"}
          </button>
        </div>
      </div>
    </div>
  );
}
