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
      .then((data) => { if (active) setPlayers(data); })
      .catch((reason) => { if (active) setError(reason instanceof ApiError ? reason.message : "Failed to load players."); })
      .finally(() => { if (active) setLoading(false); });
    api.cards().then((data) => { if (active) setCards(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

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
      Promise.all([
        api.recommendation(player.player_id, 6, true, true),
        api.player(player.player_id).catch(() => null),
      ])
        .then(([recommendation, detail]) => setDeckPreviews((current) => ({
          ...current,
          [player.player_id]: {
            loading: false,
            recommendation,
            cardLevels: Object.fromEntries(
              (detail?.stats?.card_list ?? []).map((card) => [normalizeCardKey(card.card_id), card.level]),
            ),
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
          <h1>Raid deck recommendations</h1>
          <p>Select a player to view their current boss simulation and optimized six- or nine-deck lineup.</p>
        </div>
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
              <span
                className={`status-dot ${player.stats_revision === null ? "off" : "on"}`}
                title={player.stats_revision === null ? "Deck not ready" : "Deck ready"}
                aria-label={player.stats_revision === null ? "Deck not ready" : "Deck ready"}
              />
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
