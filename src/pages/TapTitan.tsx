import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, assetUrl } from "../api/client";
import type { CardDefinition, PlayerSummary, Recommendation } from "../api/types";
import Navbar from "../components/Navbar";

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

const loadRecommendationOrNull = async (playerId: string, includeBodyPhase: boolean) => {
  try {
    const recommendation = await api.recommendation(playerId, 6, true, true, includeBodyPhase);
    return includeBodyPhase && !recommendation.body_phase_ran ? null : recommendation;
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
    (total, recommendation) => total + BigInt(recommendation.total_average_damage.split(".")[0]),
    0n,
  );
  const totalDecks = available.reduce((total, recommendation) => total + recommendation.decks.length, 0);
  return {
    totalDamage: totalDamage.toString(),
    averagePerDeck: totalDecks === 0 ? "0" : (totalDamage / BigInt(totalDecks)).toString(),
    playersCalculated: available.length,
    totalDecks,
    checksFailed: players.filter((player) => mode === "current"
      ? Boolean(recommendations[player.player_id]?.currentError)
      : Boolean(recommendations[player.player_id]?.combinedError)).length,
  };
};

const readableCardName = (cardId: string) =>
  cardId.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
const normalizeCardKey = (cardId: string) =>
  cardId.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
const formatDamage = (value: string) => {
  try {
    return BigInt(value.split(".")[0]).toLocaleString();
  } catch {
    return value;
  }
};

export default function TapTitan() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredPlayerId, setHoveredPlayerId] = useState("");
  const [deckPreviews, setDeckPreviews] = useState<Record<string, DeckPreview>>({});
  const [clanRecommendations, setClanRecommendations] = useState<Record<string, PlayerRecommendationModes>>({});
  const [clanRecommendationsLoading, setClanRecommendationsLoading] = useState(true);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    api.players()
      .then(async (data) => {
        if (!active) return;
        setPlayers(data);
        const loaded = await Promise.all(data.map(async (player) => {
          const [currentResult, combinedResult] = await Promise.allSettled([
            loadRecommendationOrNull(player.player_id, false),
            loadRecommendationOrNull(player.player_id, true),
          ]);
          return [player.player_id, {
            current: currentResult.status === "fulfilled" ? currentResult.value : null,
            combined: combinedResult.status === "fulfilled" ? combinedResult.value : null,
            currentError: currentResult.status === "rejected" ? (currentResult.reason instanceof ApiError ? currentResult.reason.message : "Could not load current recommendation.") : undefined,
            combinedError: combinedResult.status === "rejected" ? (combinedResult.reason instanceof ApiError ? combinedResult.reason.message : "Could not load Body/Void recommendation.") : undefined,
          }] as const;
        }));
        if (active) setClanRecommendations(Object.fromEntries(loaded));
      })
      .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message : "Failed to load players."); })
      .finally(() => { if (active) { setLoading(false); setClanRecommendationsLoading(false); } });
    api.cards().then((data) => { if (active) setCards(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const currentSummary = summarizeRecommendations(players, clanRecommendations, "current");
  const combinedSummary = summarizeRecommendations(players, clanRecommendations, "combined");

  const cardDefinitions = new Map(
    cards.map((card) => [normalizeCardKey(card.id), card] as const),
  );

  useEffect(() => () => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
  }, []);

  const beginDeckPreview = (player: PlayerSummary) => {
    setHoveredPlayerId(player.player_id);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    if (deckPreviews[player.player_id]?.recommendation || deckPreviews[player.player_id]?.loading) return;

    previewTimerRef.current = setTimeout(() => {
      setDeckPreviews((current) => ({
        ...current,
        [player.player_id]: { loading: true },
      }));
      const loadedModes = clanRecommendations[player.player_id];
      const recommendationPromise = loadedModes
        ? Promise.resolve(loadedModes.combined ?? loadedModes.current)
        : loadRecommendationOrNull(player.player_id, true)
            .then((combined) => combined ?? loadRecommendationOrNull(player.player_id, false));
      Promise.all([
        recommendationPromise,
        api.player(player.player_id).catch(() => null),
      ])
        .then(([recommendation, detail]) => setDeckPreviews((current) => ({
          ...current,
          [player.player_id]: recommendation ? {
            loading: false,
            recommendation,
            cardLevels: Object.fromEntries(
              (detail?.stats?.card_list ?? []).map((card) => [normalizeCardKey(card.card_id), card.level]),
            ),
          } : {
            loading: false,
            error: "No six-deck recommendation is ready.",
          },
        })))
        .catch((reason) => setDeckPreviews((current) => ({
          ...current,
          [player.player_id]: {
            loading: false,
            error: reason instanceof ApiError && reason.status === 404
              ? "No six-deck recommendation is ready."
              : reason instanceof ApiError
                ? reason.message
                : "Could not load deck preview.",
          },
        })));
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
          <p>Select a player to view their current boss simulation and optimized six- or nine-deck lineup.</p>
        </div>
        <section className="clan-recommendation-summary" aria-label="Clan recommendation totals">
          {clanRecommendationsLoading && <p>Fetching recommendations for all listed players…</p>}
          {!clanRecommendationsLoading && <>
            <div className="clan-summary-mode">
              <h2>Current boss only</h2>
              <span>Combined average damage</span><strong>{formatDamage(currentSummary.totalDamage)}</strong>
              <span>Average damage per deck</span><strong>{formatDamage(currentSummary.averagePerDeck)}</strong>
              <small>{currentSummary.playersCalculated} / {players.length} players · {currentSummary.totalDecks} decks calculated{currentSummary.checksFailed > 0 ? ` · ${currentSummary.checksFailed} checks failed` : ""}</small>
            </div>
            <div className="clan-summary-mode body">
              <h2>Current + Body/Void phase</h2>
              <span>Combined average damage</span><strong>{formatDamage(combinedSummary.totalDamage)}</strong>
              <span>Average damage per deck</span><strong>{formatDamage(combinedSummary.averagePerDeck)}</strong>
              <small>{combinedSummary.playersCalculated} / {players.length} players · {combinedSummary.totalDecks} decks calculated{combinedSummary.checksFailed > 0 ? ` · ${combinedSummary.checksFailed} checks failed` : ""}</small>
            </div>
          </>}
        </section>
        {loading && <div className="panel empty-state">Loading players…</div>}
        {!loading && error && <div className="error-box standalone-error">{error}</div>}
        {!loading && !error && players.length === 0 && (
          <div className="panel empty-state"><h2>No players yet</h2><p>Create a player from the admin page before requesting recommendations.</p><Link className="btn-primary" to="/tools/taptitan/admin">Open admin</Link></div>
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
              onMouseEnter={() => beginDeckPreview(player)}
              onMouseLeave={endDeckPreview}
              onFocus={() => beginDeckPreview(player)}
              onBlur={endDeckPreview}
            >
                  <div><h2>{player.display_name}</h2><p>{player.player_id}</p></div>
              <span className="arrow" aria-hidden="true">→</span>
              {hoveredPlayerId === player.player_id && (
                <div className="player-deck-preview" role="status">
                  <strong>Best 6 decks</strong>
                  <small>Mirror Force + Team Tactics</small>
                  {!deckPreviews[player.player_id] && <p>Loading preview…</p>}
                  {deckPreviews[player.player_id]?.loading && <p>Loading preview…</p>}
                  {deckPreviews[player.player_id]?.error && <p>{deckPreviews[player.player_id].error}</p>}
                  {deckPreviews[player.player_id]?.recommendation && (
                    <>
                      <small className="preview-total-damage">
                        Total avg dmg: {formatDamage(deckPreviews[player.player_id]!.recommendation!.total_average_damage)}
                      </small>
                      <ol>
                      {[...deckPreviews[player.player_id]!.recommendation!.decks]
                        .sort((left, right) => left.position - right.position)
                        .slice(0, 6)
                        .map((deck, index) => {
                          const cards = deck.cards?.length ? deck.cards : deck.result?.deck ?? [];
                          return (
                            <li key={`${deck.position}-${index}`}>
                              <span className="preview-deck-cards">
                                {cards.slice(0, 3).map((cardId) => {
                                  const definition = cardDefinitions.get(normalizeCardKey(cardId));
                                  const cardName = definition?.name ?? readableCardName(cardId);
                                  const level = deckPreviews[player.player_id]?.cardLevels?.[normalizeCardKey(cardId)];
                                  const cardDamage = deck.result?.best_pattern?.card_damage?.find(
                                    (entry) => normalizeCardKey(entry.card) === normalizeCardKey(cardId),
                                  );
                                  return <span className="preview-card-slot" key={cardId}>
                                    <span className="preview-card-image">
                                      {definition?.image ? (
                                        <img src={assetUrl(definition.image)} alt={cardName} title={cardName} />
                                      ) : (
                                        <span role="img" aria-label={`${cardName} image unavailable`}>?</span>
                                      )}
                                      {level !== undefined && <small className="card-level-badge">Lv {level}</small>}
                                    </span>
                                    <small className="card-damage-label">{cardDamage?.average_damage_display ?? "—"}</small>
                                  </span>;
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
        {!loading && !error && players.length > 0 && filteredPlayers.length === 0 && (
          <div className="empty-state compact-empty">No players match your search.</div>
        )}
      </main>
    </div>
  );
}
