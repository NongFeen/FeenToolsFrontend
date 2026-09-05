import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, assetUrl, cardImagePath } from "../api/client";
import type {
  CardDefinition,
  PlayerSummary,
  RaidCycle,
  Recommendation,
} from "../api/types";
import Navbar from "../components/Navbar";
import RaidResetCountdown from "../components/RaidResetCountdown";

interface DeckPreview {
  loading: boolean;
  recommendation?: Recommendation;
  cardLevels?: Record<string, number>;
  error?: string;
}

interface PlayerRecommendationModes {
  current: Recommendation | null;
  combined: Recommendation | null;
  currentError?: string;
  combinedError?: string;
}

interface PreviewLayout {
  placement: "above" | "below";
  maxHeight: number;
}

const loadRecommendationOrNull = async (
  playerId: string,
  includeBodyPhase: boolean,
) => {
  try {
    const recommendation = await api.recommendation(
      playerId,
      6,
      true,
      true,
      includeBodyPhase,
    );
    return includeBodyPhase && !recommendation.body_phase_ran
      ? null
      : recommendation;
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404) return null;
    throw reason;
  }
};

const summarizeRecommendations = (
  players: PlayerSummary[],
  recommendations: Record<string, PlayerRecommendationModes>,
  mode: "current" | "combined",
) => {
  const available = players.flatMap((player) => {
    const recommendation = recommendations[player.player_id]?.[mode];
    return recommendation ? [recommendation] : [];
  });
  const totalDamage = available.reduce(
    (total, recommendation) =>
      total + BigInt(recommendation.total_average_damage.split(".")[0]),
    0n,
  );
  const totalDecks = available.reduce(
    (total, recommendation) => total + recommendation.decks.length,
    0,
  );
  return {
    totalDamage: totalDamage.toString(),
    averagePerDeck:
      totalDecks === 0 ? "0" : (totalDamage / BigInt(totalDecks)).toString(),
    playersCalculated: available.length,
    totalDecks,
    checksFailed: players.filter((player) =>
      mode === "current"
        ? Boolean(recommendations[player.player_id]?.currentError)
        : Boolean(recommendations[player.player_id]?.combinedError),
    ).length,
  };
};

const readableCardName = (cardId: string) =>
  cardId.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
const normalizeCardKey = (cardId: string) =>
  cardId.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
const clampPercent = (value: number, maximum: number) =>
  Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : 0;
const formatDamage = (value: string, multiplier = 1) => {
  try {
    const wholeDamage = BigInt(value.split(".")[0]);
    const scale = 1_000_000n;
    const scaledMultiplier = BigInt(Math.round(multiplier * Number(scale)));
    return ((wholeDamage * scaledMultiplier) / scale).toLocaleString();
  } catch {
    return value;
  }
};
const formatCompactDamage = (
  value: string | number | undefined,
  multiplier = 1,
) => {
  if (value === undefined) return "—";
  const damage = Number(value) * multiplier;
  if (!Number.isFinite(damage)) return String(value);
  return new Intl.NumberFormat("en", {
    notation: "compact",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(damage);
};

export default function TapTitan() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [moralePercent, setMoralePercent] = useState(0);
  const [raidCycle, setRaidCycle] = useState<RaidCycle | null>(null);
  const [raidCycleLoading, setRaidCycleLoading] = useState(true);
  const [loyaltyPercent, setLoyaltyPercent] = useState(34);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredPlayerId, setHoveredPlayerId] = useState("");
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>({
    placement: "below",
    maxHeight: 480,
  });
  const [deckPreviews, setDeckPreviews] = useState<Record<string, DeckPreview>>(
    {},
  );
  const [clanRecommendations, setClanRecommendations] = useState<
    Record<string, PlayerRecommendationModes>
  >({});
  const [clanRecommendationsLoading, setClanRecommendationsLoading] =
    useState(true);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRequestsRef = useRef(new Set<string>());
  const raidCycleRequestRef = useRef<Promise<RaidCycle> | null>(null);
  const moraleManuallyEditedRef = useRef(false);
  const damageMultiplier =
    (1 + moralePercent / 100) * (1 + loyaltyPercent / 100);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredPlayers = normalizedSearch
    ? players.filter((player) =>
        `${player.display_name} ${player.player_id}`
          .toLocaleLowerCase()
          .includes(normalizedSearch),
      )
    : players;

  useEffect(() => {
    let active = true;
    api
      .players()
      .then(async (data) => {
        if (!active) return;
        setPlayers(data);
        const loaded = await Promise.all(
          data.map(async (player) => {
            const [currentResult, combinedResult] = await Promise.allSettled([
              loadRecommendationOrNull(player.player_id, false),
              loadRecommendationOrNull(player.player_id, true),
            ]);
            return [
              player.player_id,
              {
                current:
                  currentResult.status === "fulfilled"
                    ? currentResult.value
                    : null,
                combined:
                  combinedResult.status === "fulfilled"
                    ? combinedResult.value
                    : null,
                currentError:
                  currentResult.status === "rejected"
                    ? currentResult.reason instanceof ApiError
                      ? currentResult.reason.message
                      : "Could not load current recommendation."
                    : undefined,
                combinedError:
                  combinedResult.status === "rejected"
                    ? combinedResult.reason instanceof ApiError
                      ? combinedResult.reason.message
                      : "Could not load Body/Void recommendation."
                    : undefined,
              },
            ] as const;
          }),
        );
        if (active) setClanRecommendations(Object.fromEntries(loaded));
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof ApiError
              ? reason.message
              : "Failed to load players.",
          );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setClanRecommendationsLoading(false);
        }
      });
    api
      .cards()
      .then((data) => {
        if (active) setCards(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    raidCycleRequestRef.current ??= api.currentRaidCycle();
    raidCycleRequestRef.current
      .then((cycle) => {
        if (!active) return;
        setRaidCycle(cycle);
        if (!moraleManuallyEditedRef.current) {
          setMoralePercent(
            Math.min(100, Math.max(0, cycle.default_morale_percent)),
          );
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setRaidCycleLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentSummary = summarizeRecommendations(
    players,
    clanRecommendations,
    "current",
  );
  const combinedSummary = summarizeRecommendations(
    players,
    clanRecommendations,
    "combined",
  );

  const cardDefinitions = new Map(
    cards.map((card) => [normalizeCardKey(card.id), card] as const),
  );

  useEffect(
    () => () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    },
    [],
  );

  const loadDeckPreview = (player: PlayerSummary) => {
    if (
      previewRequestsRef.current.has(player.player_id) ||
      deckPreviews[player.player_id]?.recommendation ||
      deckPreviews[player.player_id]?.loading
    )
      return;
    previewRequestsRef.current.add(player.player_id);
    setDeckPreviews((current) => ({
      ...current,
      [player.player_id]: { loading: true },
    }));
    const loadedModes = clanRecommendations[player.player_id];
    const recommendationPromise = loadedModes
      ? Promise.resolve(loadedModes.combined ?? loadedModes.current)
      : loadRecommendationOrNull(player.player_id, true).then(
          (combined) =>
            combined ?? loadRecommendationOrNull(player.player_id, false),
        );
    Promise.all([
      recommendationPromise,
      api.player(player.player_id).catch(() => null),
    ])
      .then(([recommendation, detail]) =>
        setDeckPreviews((current) => ({
          ...current,
          [player.player_id]: recommendation
            ? {
                loading: false,
                recommendation,
                cardLevels: Object.fromEntries(
                  (detail?.stats?.card_list ?? []).map((card) => [
                    normalizeCardKey(card.card_id),
                    card.level,
                  ]),
                ),
              }
            : {
                loading: false,
                error: "No six-deck recommendation is ready.",
              },
        })),
      )
      .catch((reason) =>
        setDeckPreviews((current) => ({
          ...current,
          [player.player_id]: {
            loading: false,
            error:
              reason instanceof ApiError && reason.status === 404
                ? "No six-deck recommendation is ready."
                : reason instanceof ApiError
                  ? reason.message
                  : "Could not load deck preview.",
          },
        })),
      );
  };

  const playersInPreviewRange = (
    player: PlayerSummary,
    anchor: HTMLElement,
  ) => {
    const grid = anchor.parentElement;
    const currentIndex = filteredPlayers.findIndex(
      (candidate) => candidate.player_id === player.player_id,
    );
    if (!grid || currentIndex < 0) return [player];
    const templateColumns = window.getComputedStyle(grid).gridTemplateColumns;
    const columnCount = Math.max(
      1,
      templateColumns.trim().split(/\s+/).filter(Boolean).length,
    );
    const currentRow = Math.floor(currentIndex / columnCount);
    const currentColumn = currentIndex % columnCount;
    const nearby = new Set<number>();
    for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
      for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
        const row = currentRow + rowOffset;
        const column = currentColumn + columnOffset;
        if (row < 0 || column < 0 || column >= columnCount) continue;
        const index = row * columnCount + column;
        if (index < filteredPlayers.length) nearby.add(index);
      }
    }
    return [...nearby].map((index) => filteredPlayers[index]);
  };

  const beginDeckPreview = (player: PlayerSummary, anchor: HTMLElement) => {
    const bounds = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - bounds.bottom - 8;
    const spaceAbove = bounds.top - 8;
    const placement = spaceBelow >= spaceAbove ? "below" : "above";
    setPreviewLayout({
      placement,
      maxHeight: Math.max(
        0,
        Math.floor(placement === "below" ? spaceBelow : spaceAbove),
      ),
    });
    setHoveredPlayerId(player.player_id);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    previewTimerRef.current = setTimeout(() => {
      playersInPreviewRange(player, anchor).forEach(loadDeckPreview);
    }, 300);
  };

  const endDeckPreview = () => {
    setHoveredPlayerId("");
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = null;
  };

  return (
    <div className="page">
      <Navbar />
      <main className="page-shell">
        <div className="page-header">
          <span className="eyebrow">Tap Titans 2</span>
          <h1>Kero Clan deck recommendations</h1>
        </div>
        <section
          className="clan-recommendation-summary"
          aria-label="Clan recommendation totals"
        >
          <div className="clan-damage-modifier-row">
            <strong>Damage modifiers</strong>
            <div className="damage-modifier-controls">
              <label className="damage-percent-control">
                <span>Morale %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={moralePercent}
                  onChange={(event) => {
                    moraleManuallyEditedRef.current = true;
                    setMoralePercent(
                      clampPercent(event.currentTarget.valueAsNumber, 100),
                    );
                  }}
                />
              </label>
              <label className="damage-percent-control">
                <span>Loyalty %</span>
                <input
                  type="number"
                  min={0}
                  max={34}
                  step={1}
                  value={loyaltyPercent}
                  onChange={(event) =>
                    setLoyaltyPercent(
                      clampPercent(event.currentTarget.valueAsNumber, 34),
                    )
                  }
                />
              </label>
            </div>
          </div>
          {clanRecommendationsLoading && (
            <p>Fetching recommendations for all listed players…</p>
          )}
          {!clanRecommendationsLoading && (
            <>
              <div className="clan-summary-mode">
                <h2>Current boss only</h2>
                <span>Combined average damage</span>
                <strong>
                  {formatCompactDamage(
                    currentSummary.totalDamage,
                    damageMultiplier,
                  )}
                </strong>
                <span>Average damage per deck</span>
                <strong>
                  {formatCompactDamage(
                    currentSummary.averagePerDeck,
                    damageMultiplier,
                  )}
                </strong>
                <small>
                  {currentSummary.playersCalculated} / {players.length} players
                  · {currentSummary.totalDecks} decks calculated
                  {currentSummary.checksFailed > 0
                    ? ` · ${currentSummary.checksFailed} checks failed`
                    : ""}
                </small>
              </div>
              <div className="clan-summary-mode body">
                <h2>Current + Void </h2>
                <span>Combined average damage</span>
                <strong>
                  {formatCompactDamage(
                    combinedSummary.totalDamage,
                    damageMultiplier,
                  )}
                </strong>
                <span>Average damage per deck</span>
                <strong>
                  {formatCompactDamage(
                    combinedSummary.averagePerDeck,
                    damageMultiplier,
                  )}
                </strong>
                <small>
                  {combinedSummary.playersCalculated} / {players.length} players{" "}
                  {combinedSummary.checksFailed > 0
                    ? ` · ${combinedSummary.checksFailed} checks failed`
                    : ""}
                </small>
              </div>
              <RaidResetCountdown
                cycle={raidCycle}
                loading={raidCycleLoading}
              />
            </>
          )}
        </section>
        {loading && (
          <div className="player-grid" aria-busy="true" aria-label="Loading players">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="player-option-skeleton" key={index} />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="error-box standalone-error">{error}</div>
        )}
        {!loading && !error && players.length === 0 && (
          <div className="panel empty-state">
            <h2>No players yet</h2>
            <p>Clan player data has not been loaded yet. Check back soon.</p>
          </div>
        )}
        {!loading && !error && players.length > 0 && (
          <label className="player-search">
            <input
              type="search"
              aria-label="Search players"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search players…"
            />
          </label>
        )}
        <div className="player-grid">
          {filteredPlayers.map((player) => (
            <Link
              className="player-option"
              key={player.player_id}
              to={`/tools/taptitan/players/${encodeURIComponent(player.player_id)}`}
              onMouseEnter={(event) =>
                beginDeckPreview(player, event.currentTarget)
              }
              onMouseLeave={endDeckPreview}
              onFocus={(event) => beginDeckPreview(player, event.currentTarget)}
              onBlur={endDeckPreview}
            >
              <div>
                <h2>{player.display_name}</h2>
                <p>{player.player_id}</p>
              </div>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              {hoveredPlayerId === player.player_id && (
                <div
                  className={`player-deck-preview ${previewLayout.placement}`}
                  role="status"
                  style={{ maxHeight: previewLayout.maxHeight }}
                >
                  <strong>Best 6 decks</strong>
                  <small>Mirror Force + Team Tactics</small>
                  {!deckPreviews[player.player_id] && <p>Loading preview…</p>}
                  {deckPreviews[player.player_id]?.loading && (
                    <p>Loading preview…</p>
                  )}
                  {deckPreviews[player.player_id]?.error && (
                    <p>{deckPreviews[player.player_id].error}</p>
                  )}
                  {deckPreviews[player.player_id]?.recommendation && (
                    <>
                      <small className="preview-total-damage">
                        Total avg dmg:{" "}
                        {formatDamage(
                          deckPreviews[player.player_id]!.recommendation!
                            .total_average_damage,
                          damageMultiplier,
                        )}
                      </small>
                      <ol>
                        {[
                          ...deckPreviews[player.player_id]!.recommendation!
                            .decks,
                        ]
                          .sort((left, right) => left.position - right.position)
                          .slice(0, 6)
                          .map((deck, index) => {
                            const cards = deck.cards?.length
                              ? deck.cards
                              : (deck.result?.deck ?? []);
                            return (
                              <li key={`${deck.position}-${index}`}>
                                <span className="preview-deck-cards">
                                  {cards.slice(0, 3).map((cardId) => {
                                    const definition = cardDefinitions.get(
                                      normalizeCardKey(cardId),
                                    );
                                    const cardName =
                                      definition?.name ??
                                      readableCardName(cardId);
                                    const level =
                                      deckPreviews[player.player_id]
                                        ?.cardLevels?.[
                                        normalizeCardKey(cardId)
                                      ];
                                    const cardDamage =
                                      deck.result?.best_pattern?.card_damage?.find(
                                        (entry) =>
                                          normalizeCardKey(entry.card) ===
                                          normalizeCardKey(cardId),
                                      );
                                    return (
                                      <span
                                        className="preview-card-slot"
                                        key={cardId}
                                      >
                                        <span className="preview-card-image">
                                          {definition ? (
                                            <img
                                              src={assetUrl(cardImagePath(cardId))}
                                              alt={cardName}
                                              title={cardName}
                                            />
                                          ) : (
                                            <span
                                              role="img"
                                              aria-label={`${cardName} image unavailable`}
                                            >
                                              ?
                                            </span>
                                          )}
                                          {level !== undefined && (
                                            <small className="card-level-badge">
                                              Lv {level}
                                              {Boolean(
                                                definition?.seasonal_level_boost,
                                              ) && (
                                                <span className="seasonal-level-inline">
                                                  +
                                                  {
                                                    definition!
                                                      .seasonal_level_boost
                                                  }
                                                </span>
                                              )}
                                            </small>
                                          )}
                                        </span>
                                        <small className="card-damage-label">
                                          {formatCompactDamage(
                                            cardDamage?.average_damage,
                                            damageMultiplier,
                                          )}
                                        </small>
                                      </span>
                                    );
                                  })}
                                </span>
                              </li>
                            );
                          })}
                      </ol>
                    </>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
        {!loading &&
          !error &&
          players.length > 0 &&
          filteredPlayers.length === 0 && (
            <div className="empty-state compact-empty">
              No players match your search.
            </div>
          )}
      </main>
    </div>
  );
}
