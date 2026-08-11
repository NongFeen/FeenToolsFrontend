import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { PlayerSummary } from "../api/types";
import Navbar from "../components/Navbar";

export default function TapTitan() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    return () => { active = false; };
  }, []);

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
            <Link className="player-option" key={player.player_id} to={`/tools/taptitan/players/${encodeURIComponent(player.player_id)}`}>
              <div><h2>{player.display_name}</h2><p>{player.player_id}</p></div>
              <span
                className={`status-dot ${player.stats_revision === null ? "off" : "on"}`}
                title={player.stats_revision === null ? "Deck not ready" : "Deck ready"}
                aria-label={player.stats_revision === null ? "Deck not ready" : "Deck ready"}
              />
              <span className="arrow" aria-hidden="true">→</span>
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
