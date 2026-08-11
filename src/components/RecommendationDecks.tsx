import { assetUrl } from "../api/client";
import type { CardDefinition, PlayerCard, Recommendation, RecommendedDeck } from "../api/types";

const normalizeCardKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const formatDamage = (value: string | number | undefined, multiplier = 1) => {
  if (value === undefined) return "—";
  try {
    const wholeDamage = BigInt(String(value).split(".")[0]);
    const scale = 1_000_000n;
    const scaledMultiplier = BigInt(Math.round(multiplier * Number(scale)));
    return ((wholeDamage * scaledMultiplier) / scale).toLocaleString();
  } catch { return String(value); }
};

const formatCompactDamage = (value: string | number | undefined, multiplier = 1) => {
  if (value === undefined) return "—";
  const damage = Number(value) * multiplier;
  if (!Number.isFinite(damage)) return String(value);
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(damage);
};

const averageDamageValue = (deck: RecommendedDeck) => {
  const wholeNumber = String(
    deck.average_damage ?? deck.result?.best_pattern?.average_damage ?? 0,
  ).split(".")[0];
  try { return BigInt(wholeNumber); } catch { return 0n; }
};

const compareAverageDamage = (left: RecommendedDeck, right: RecommendedDeck) => {
  const leftDamage = averageDamageValue(left);
  const rightDamage = averageDamageValue(right);
  if (leftDamage === rightDamage) return left.position - right.position;
  return leftDamage > rightDamage ? -1 : 1;
};

interface Props {
  recommendation: Recommendation | null;
  cards: CardDefinition[];
  playerCards?: PlayerCard[];
  loading: boolean;
  error: string;
  emptyMessage?: string;
  damageMultiplier?: number;
  moralePercent?: number;
  loyaltyPercent?: number;
}

export default function RecommendationDecks({
  recommendation,
  cards,
  playerCards = [],
  loading,
  error,
  emptyMessage,
  damageMultiplier = 1,
  moralePercent = 0,
  loyaltyPercent = 0,
}: Props) {
  if (loading) return <div className="empty-state">Loading recommendations…</div>;
  if (error) return <div className="error-box recommendation-error">{error}</div>;
  if (!recommendation || recommendation.decks.length === 0) return <div className="empty-state">{emptyMessage ?? "No completed recommendation is available for this deck count."}</div>;
  const definitions = new Map(cards.map((card) => [normalizeCardKey(card.id), card] as const));
  const levels = new Map(playerCards.map((card) => [normalizeCardKey(card.card_id), card.level] as const));
  const sortedDecks = [...recommendation.decks].sort(compareAverageDamage);
  return (
    <>
      <div className="total-damage-card">
        <span>
          Total combined average damage
          {(moralePercent > 0 || loyaltyPercent > 0) && (
            <small>Morale {moralePercent}% × Loyalty {loyaltyPercent}%</small>
          )}
        </span>
        <strong>{formatDamage(recommendation.total_average_damage, damageMultiplier)}</strong>
      </div>
      <div className="recommendation-grid">
        {sortedDecks.map((deck, index) => {
          const pattern = deck.result?.best_pattern;
          const deckCards = deck.cards?.length ? deck.cards : deck.result?.deck ?? [];
          return (
            <article className="deck-card" key={`${deck.position}-${index}`}>
              <div className="deck-heading"><div className="deck-number">Deck {index + 1}</div></div>
              <div className="deck-images">
                {deckCards.slice(0, 3).map((cardId) => {
                  const definition = definitions.get(normalizeCardKey(cardId));
                  const readableId = cardId.replace(/([A-Z])/g, " $1").trim();
                  const alt = `${definition?.name ?? readableId} raid card`;
                  const level = levels.get(normalizeCardKey(cardId));
                  const cardDamage = pattern?.card_damage?.find(
                    (entry) => normalizeCardKey(entry.card) === normalizeCardKey(cardId),
                  );
                  return <span className="deck-image-wrap" key={cardId}>
                    <span className="card-art-wrap">
                      {definition?.image ? <img src={assetUrl(definition.image)} alt={alt} loading="lazy" /> : <span className="deck-image-missing" role="img" aria-label={`${alt} image unavailable`}>Image unavailable</span>}
                      {level !== undefined && <small className="card-level-badge">Lv {level}</small>}
                    </span>
                    <small className="card-damage-label">{formatCompactDamage(cardDamage?.average_damage, damageMultiplier)}</small>
                  </span>;
                })}
              </div>
              <dl className="deck-metrics">
                <div className="pattern-row"><dt>Attack pattern</dt><dd>{pattern?.pattern ?? "Unavailable"}</dd></div>
                <div><dt>Average</dt><dd>{formatDamage(pattern?.average_damage ?? deck.average_damage, damageMultiplier)}</dd></div>
                <div><dt>Lowest</dt><dd>{formatDamage(pattern?.lowest_round_damage, damageMultiplier)}</dd></div>
                <div><dt>Highest</dt><dd>{formatDamage(pattern?.highest_round_damage, damageMultiplier)}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
