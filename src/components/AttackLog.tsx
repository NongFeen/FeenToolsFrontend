import { assetUrl, cardImagePath } from "../api/client";
import type { CardDefinition, PlayerAttackLogEntry, RecommendedDeck } from "../api/types";

const normalizeCardKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const toBigInt = (value: string | null) => {
  if (!value) return 0n;
  try {
    return BigInt(value.split(".")[0]);
  } catch {
    return 0n;
  }
};

const formatDamage = (value: bigint | string | null | undefined) => {
  if (value === null || value === undefined) return "—";
  const amount = typeof value === "bigint" ? value : toBigInt(value);
  return amount.toLocaleString();
};

// Mirrors RecommendationDecks' scaled-BigInt approach so a fractional
// multiplier (morale/loyalty) doesn't force a lossy float conversion of a
// damage value that can exceed Number.MAX_SAFE_INTEGER.
const applyMultiplier = (amount: bigint, multiplier: number) => {
  const scale = 1_000_000n;
  const scaledMultiplier = BigInt(Math.round(multiplier * Number(scale)));
  return (amount * scaledMultiplier) / scale;
};

const formatDiff = (diff: bigint | null) => {
  if (diff === null) return "—";
  if (diff === 0n) return "0";
  const sign = diff > 0n ? "+" : "-";
  const magnitude = diff > 0n ? diff : -diff;
  return `${sign}${magnitude.toLocaleString()}`;
};

// "Near highest" isn't "at or above" -- a real attack landing this close to
// the simulated ceiling is already a standout roll worth calling out.
const NEAR_HIGHEST_FRACTION = 0.95;

// Banded against the matched sim deck's own lowest/average/highest rolls
// (not a flat % off average), so a deck with huge natural variance doesn't
// get flagged red/rainbow for swings that are normal for it specifically.
const diffClass = (realDamage: bigint, benchmark: SimBenchmark | null) => {
  if (!benchmark) return "";
  const { lowestDamage, averageDamage, highestDamage } = benchmark;
  if (lowestDamage !== null && realDamage < lowestDamage) return "attack-log-diff-red";
  if (highestDamage !== null && realDamage >= applyMultiplier(highestDamage, NEAR_HIGHEST_FRACTION)) {
    return "attack-log-diff-rainbow";
  }
  if (realDamage > averageDamage) return "attack-log-diff-green";
  return "attack-log-diff-neutral";
};

const deckCardsOf = (entry: PlayerAttackLogEntry) =>
  [entry.card1, entry.card2, entry.card3].filter((card): card is string => Boolean(card));

const deckKey = (cards: string[]) =>
  cards.length > 0 ? [...cards].map(normalizeCardKey).sort().join("|") : null;

interface SimBenchmark {
  averageDamage: bigint;
  lowestDamage: bigint | null;
  highestDamage: bigint | null;
}

const toBigIntFromNumber = (value: number | undefined) =>
  value === undefined ? null : BigInt(Math.trunc(value));

function buildSimBenchmarkLookup(recommendedDecks: RecommendedDeck[], damageMultiplier: number) {
  const lookup = new Map<string, SimBenchmark>();
  for (const deck of recommendedDecks) {
    const key = deckKey(deck.cards ?? []);
    if (!key) continue;
    const pattern = deck.result?.best_pattern;
    const lowest = toBigIntFromNumber(pattern?.lowest_round_damage);
    const highest = toBigIntFromNumber(pattern?.highest_round_damage);
    lookup.set(key, {
      averageDamage: applyMultiplier(toBigInt(deck.average_damage), damageMultiplier),
      lowestDamage: lowest === null ? null : applyMultiplier(lowest, damageMultiplier),
      highestDamage: highest === null ? null : applyMultiplier(highest, damageMultiplier),
    });
  }
  return lookup;
}

interface SimComparison {
  diff: bigint;
  benchmark: SimBenchmark;
}

// Real damage vs. the matching sim-recommended deck's expected damage
// (adjusted for the current morale/loyalty multiplier) -- null when this
// exact card combination isn't one of the recommended decks.
const compareToSim = (
  cards: string[],
  realDamage: bigint,
  simLookup: Map<string, SimBenchmark>,
): SimComparison | null => {
  const key = deckKey(cards);
  if (!key) return null;
  const benchmark = simLookup.get(key);
  if (!benchmark) return null;
  return { diff: realDamage - benchmark.averageDamage, benchmark };
};

interface DeckGroup {
  key: string;
  cards: string[];
  attackCount: number;
  totalDamage: bigint;
  averageDamage: bigint;
}

function groupByDeck(entries: PlayerAttackLogEntry[]): DeckGroup[] {
  const groups = new Map<string, DeckGroup>();
  for (const entry of entries) {
    const deckCards = deckCardsOf(entry);
    const key = deckCards.length > 0 ? [...deckCards].sort().join("|") : "(tap only)";
    const existing = groups.get(key);
    const damage = toBigInt(entry.total_damage);
    if (existing) {
      existing.attackCount += 1;
      existing.totalDamage += damage;
    } else {
      groups.set(key, { key, cards: deckCards, attackCount: 1, totalDamage: damage, averageDamage: 0n });
    }
  }
  for (const group of groups.values()) {
    group.averageDamage = group.attackCount > 0 ? group.totalDamage / BigInt(group.attackCount) : 0n;
  }
  return [...groups.values()].sort((a, b) =>
    b.totalDamage > a.totalDamage ? 1 : b.totalDamage < a.totalDamage ? -1 : 0,
  );
}

function DeckIcons({ cards, definitions }: { cards: string[]; definitions: Map<string, CardDefinition> }) {
  if (cards.length === 0) {
    return <span className="attack-log-tap-only">Tap only</span>;
  }
  return (
    <span className="deck-images attack-log-deck-images">
      {cards.map((cardId, index) => {
        const definition = definitions.get(normalizeCardKey(cardId));
        const readableId = cardId.replace(/([A-Z])/g, " $1").trim();
        const alt = `${definition?.name ?? readableId} raid card`;
        return (
          <span className="deck-image-wrap" key={`${cardId}-${index}`}>
            <span className="card-art-wrap">
              {definition ? (
                <img src={assetUrl(cardImagePath(cardId))} alt={alt} loading="lazy" />
              ) : (
                <span className="deck-image-missing" role="img" aria-label={`${alt} image unavailable`}>
                  Image unavailable
                </span>
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}

interface Props {
  entries: PlayerAttackLogEntry[];
  cards: CardDefinition[];
  recommendedDecks: RecommendedDeck[];
  damageMultiplier: number;
  loading: boolean;
  error: string;
}

export default function AttackLog({
  entries,
  cards,
  recommendedDecks,
  damageMultiplier,
  loading,
  error,
}: Props) {
  if (loading) return <div className="empty-state">Loading attack log…</div>;
  if (error) return <div className="error-box">{error}</div>;
  if (entries.length === 0) {
    return <div className="empty-state">No attacks recorded yet for the current raid.</div>;
  }

  const definitions = new Map(cards.map((card) => [normalizeCardKey(card.id), card] as const));
  const simBenchmarkLookup = buildSimBenchmarkLookup(recommendedDecks, damageMultiplier);
  const maxCycle = entries.reduce((max, entry) => Math.max(max, entry.cycle), entries[0].cycle);
  const currentCycleEntries = entries
    .filter((entry) => entry.cycle === maxCycle)
    .sort((a, b) => {
      const diff = toBigInt(b.total_damage) - toBigInt(a.total_damage);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
  const deckGroups = groupByDeck(entries);

  return (
    <div className="attack-log">
      <div className="attack-log-section">
        <h3 className="attack-log-subtitle">Current cycle (cycle {maxCycle})</h3>
        <p className="panel-desc">
          Decks this player has actually attacked with this cycle, compared to the sim recommendations above.
        </p>
        <div className="attack-log-rows">
          {currentCycleEntries.map((entry, index) => {
            const entryCards = deckCardsOf(entry);
            const realDamage = toBigInt(entry.total_damage);
            const comparison = compareToSim(entryCards, realDamage, simBenchmarkLookup);
            const rowClass = diffClass(realDamage, comparison?.benchmark ?? null);
            return (
              <div
                className={`attack-log-row${rowClass ? ` ${rowClass}` : ""}`}
                key={`${entry.attack_datetime}-${index}`}
              >
                <DeckIcons cards={entryCards} definitions={definitions} />
                <dl className="deck-metrics attack-log-row-metrics">
                  <div>
                    <dt>Damage</dt>
                    <dd>{formatDamage(entry.total_damage)}</dd>
                  </div>
                  <div>
                    <dt>vs Sim</dt>
                    <dd>{formatDiff(comparison?.diff ?? null)}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{new Date(entry.attack_datetime).toLocaleTimeString()}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </div>

      <div className="attack-log-section">
        <h3 className="attack-log-subtitle">Attack history (since raid start)</h3>
        <p className="panel-desc">
          Every deck this player has used since the current raid began, grouped by combination.
        </p>
        <div className="attack-log-rows">
          {deckGroups.map((group) => {
            const comparison = compareToSim(group.cards, group.averageDamage, simBenchmarkLookup);
            const rowClass = diffClass(group.averageDamage, comparison?.benchmark ?? null);
            return (
              <div className={`attack-log-row${rowClass ? ` ${rowClass}` : ""}`} key={group.key}>
                <DeckIcons cards={group.cards} definitions={definitions} />
                <dl className="deck-metrics attack-log-row-metrics attack-log-row-metrics-wide">
                  <div>
                    <dt>Attacks</dt>
                    <dd>{group.attackCount}</dd>
                  </div>
                  <div>
                    <dt>Total damage</dt>
                    <dd>{formatDamage(group.totalDamage)}</dd>
                  </div>
                  <div>
                    <dt>Average</dt>
                    <dd>{formatDamage(group.averageDamage)}</dd>
                  </div>
                  <div>
                    <dt>vs Sim (avg)</dt>
                    <dd>{formatDiff(comparison?.diff ?? null)}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
