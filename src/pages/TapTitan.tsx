import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { PlayerSummary } from "../api/types";
import Navbar from "../components/Navbar";

export default function TapTitan() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      <main className="page-shell narrow-shell">
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
        <div className="player-grid">
          {players.map((player) => (
            <Link className="player-option" key={player.player_id} to={`/tools/taptitan/players/${encodeURIComponent(player.player_id)}`}>
              <div className="player-avatar" aria-hidden="true">{player.display_name.slice(0, 1).toUpperCase()}</div>
              <div><h2>{player.display_name}</h2><p>{player.player_id}</p></div>
              <div className="player-option-meta"><span className={`status-dot ${player.auto_sims ? "on" : "off"}`} />{player.stats_revision === null ? "No stats" : `Stats r${player.stats_revision}`}</div>
              <span className="arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
