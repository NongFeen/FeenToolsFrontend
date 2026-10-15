import { assetUrl, cardImagePath } from "../api/client";
import type { CardDefinition, PlayerCard, RaidCrystalBoost } from "../api/types";

const CARD_TYPE_ORDER = ["Burst", "Affliction", "Support"];
const TOP_CARD_COUNT = 6;

const normalizeCardKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

interface DisplayedCard {
  card: PlayerCard;
  definition: CardDefinition | undefined;
  type: string;
  ownLevel: number;
  crystalBoost: number;
  seasonalBoost: number;
  crystalBoosted: boolean;
}

const effectiveLevel = (card: DisplayedCard) =>
  card.ownLevel + card.crystalBoost + card.seasonalBoost;

const byOwnLevel = (left: DisplayedCard, right: DisplayedCard) => right.ownLevel - left.ownLevel;
const byEffectiveLevel = (left: DisplayedCard, right: DisplayedCard) =>
  effectiveLevel(right) - effectiveLevel(left);

// Raid crystal boost first (TT2 raises the card to its boost level, already in
// `card.level`), then the seasonal boost on top of that.
function displayedCards(
  playerCards: PlayerCard[],
  crystalBoosts: RaidCrystalBoost[],
  definitions: Map<string, CardDefinition>,
) {
  const crystalByCard = new Map(crystalBoosts.map((boost) => [boost.card_id, boost] as const));
  return playerCards.map((card): DisplayedCard => {
    const definition = definitions.get(normalizeCardKey(card.card_id));
    const crystal = crystalByCard.get(card.card_id);
    const ownLevel = crystal?.base_level ?? card.level;
    return {
      card,
      definition,
      type: definition?.type ?? card.cardtype ?? "Other",
      ownLevel,
      crystalBoost: Math.max(0, card.level - ownLevel),
      seasonalBoost: definition?.seasonal_level_boost ?? 0,
      crystalBoosted: Boolean(crystal),
    };
  });
}

// Each card shows once: the top six by the player's own level, then the
// crystal-boosted cards, then everything else.
function splitCategory(cards: DisplayedCard[]) {
  const crystal = cards.filter((card) => card.crystalBoosted).sort(byEffectiveLevel);
  const unboosted = cards.filter((card) => !card.crystalBoosted).sort(byOwnLevel);
  return {
    top: unboosted.slice(0, TOP_CARD_COUNT),
    crystal,
    rest: unboosted.slice(TOP_CARD_COUNT).sort(byEffectiveLevel),
  };
}

function groupByType(cards: DisplayedCard[]) {
  const groups = new Map<string, DisplayedCard[]>();
  for (const card of cards) {
    const group = groups.get(card.type);
    if (group) group.push(card);
    else groups.set(card.type, [card]);
  }
  return [
    ...CARD_TYPE_ORDER.filter((type) => groups.has(type)),
    ...[...groups.keys()].filter((type) => !CARD_TYPE_ORDER.includes(type)),
  ].map((type) => ({ type, ...splitCategory(groups.get(type) ?? []) }));
}

function boostTooltip(name: string, crystalBoost: number, seasonalBoost: number) {
  const parts = [
    crystalBoost > 0 && `raid crystal +${crystalBoost}`,
    seasonalBoost > 0 && `seasonal +${seasonalBoost}`,
  ].filter(Boolean);
  return parts.length > 0 ? `${name} (${parts.join(", ")})` : name;
}

function CardTile({ card, definition, ownLevel, crystalBoost, seasonalBoost, crystalBoosted }: DisplayedCard) {
  const displayName = definition?.name ?? card.card_id.replace(/([A-Z])/g, " $1").trim();
  const totalBoost = crystalBoost + seasonalBoost;
  const boostClasses = [
    crystalBoosted && "player-card-crystal",
    seasonalBoost > 0 && "player-card-seasonal",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={`cycle-card-usage-item player-card ${boostClasses}`}
      title={boostTooltip(displayName, crystalBoost, seasonalBoost)}
    >
      <span className="card-art-wrap">
        {definition ? (
          <img src={assetUrl(cardImagePath(card.card_id))} alt={displayName} loading="lazy" />
        ) : (
          <span className="deck-image-missing" role="img" aria-label={`${displayName} image unavailable`}>
            ?
          </span>
        )}
      </span>
      <small>
        Lv {ownLevel}
        {totalBoost > 0 && <span className="player-card-boost"> +{totalBoost}</span>}
      </small>
    </div>
  );
}

function CardSection({ title, cards, gridClass }: { title: string; cards: DisplayedCard[]; gridClass: string }) {
  if (cards.length === 0) return null;
  return (
    <div className="player-cards-section">
      <span className="player-cards-section-title">{title}</span>
      <div className={gridClass}>
        {cards.map((card) => (
          <CardTile key={card.card.card_id} {...card} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  playerCards: PlayerCard[];
  crystalBoosts: RaidCrystalBoost[];
  cards: CardDefinition[];
}

export default function PlayerCards({ playerCards, crystalBoosts, cards }: Props) {
  if (playerCards.length === 0) {
    return <div className="empty-state">No card data for this player yet.</div>;
  }
  const definitions = new Map(cards.map((card) => [normalizeCardKey(card.id), card] as const));
  const categories = groupByType(displayedCards(playerCards, crystalBoosts, definitions));

  return (
    <div className="player-cards-categories">
      {categories.map(({ type, top, crystal, rest }) => (
        <section className="player-cards-category" key={type} aria-label={`${type} cards`}>
          <h4 className="cycle-card-usage-group-title">{type}</h4>
          <CardSection title={`Top ${TOP_CARD_COUNT}`} cards={top} gridClass="player-cards-top-grid" />
          <CardSection title="Raid crystal" cards={crystal} gridClass="cycle-card-usage-grid" />
          <CardSection title="Other cards" cards={rest} gridClass="cycle-card-usage-grid" />
        </section>
      ))}
    </div>
  );
}
