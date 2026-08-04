import { assetUrl } from "../api/client";
import type { CardDefinition, Recommendation } from "../api/types";

const normalizeCardKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const formatDamage = (value: string | number | undefined) => {
  if (value === undefined) return "—";
  try { return BigInt(String(value)).toLocaleString(); } catch { return String(value); }
};

interface Props { recommendation: Recommendation | null; cards: CardDefinition[]; loading: boolean; error: string; emptyMessage?: string; }

export default function RecommendationDecks({ recommendation, cards, loading, error, emptyMessage }: Props) {
  if (loading) return <div className="empty-state">Loading recommendations…</div>;
  if (error) return <div className="error-box recommendation-error">{error}</div>;
  if (!recommendation || recommendation.decks.length === 0) return <div className="empty-state">{emptyMessage ?? "No completed recommendation is available for this deck count."}</div>;
  const definitions = new Map(cards.map((card) => [normalizeCardKey(card.id), card] as const));
  return (
    <>
      <div className="total-damage-card"><span>Total combined average damage</span><strong>{formatDamage(recommendation.total_average_damage)}</strong></div>
      <div className="recommendation-grid">
        {recommendation.decks.map((deck, index) => {
          const pattern = deck.result?.best_pattern;
          const deckCards = deck.cards?.length ? deck.cards : deck.result?.deck ?? [];
          return (
            <article className="deck-card" key={`${deck.position}-${index}`}>
              <div className="deck-number">Deck {deck.position + 1}</div>
              <div className="deck-images">
                {deckCards.slice(0, 3).map((cardId) => {
                  const definition = definitions.get(normalizeCardKey(cardId));
                  const readableId = cardId.replace(/([A-Z])/g, " $1").trim();
                  const alt = `${definition?.name ?? readableId} raid card`;
                  return definition?.image ? <img key={cardId} src={assetUrl(definition.image)} alt={alt} loading="lazy" /> : <span key={cardId} className="deck-image-missing" role="img" aria-label={`${alt} image unavailable`}>Image unavailable</span>;
                })}
              </div>
              <dl className="deck-metrics">
                <div className="pattern-row"><dt>Attack pattern</dt><dd>{pattern?.pattern ?? "Unavailable"}</dd></div>
                <div><dt>Average</dt><dd>{formatDamage(pattern?.average_damage ?? deck.average_damage)}</dd></div>
                <div><dt>Lowest</dt><dd>{formatDamage(pattern?.lowest_round_damage)}</dd></div>
                <div><dt>Highest</dt><dd>{formatDamage(pattern?.highest_round_damage)}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </>
  );
}
