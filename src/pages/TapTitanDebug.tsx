import { useEffect, useMemo, useState } from "react";
import { api, ApiError, assetUrl } from "../api/client";
import type {
  CardDefinition,
  CurrentBoss,
  DebugSimulationResponse,
  PlayerDetail,
  PlayerSummary,
} from "../api/types";
import Navbar from "../components/Navbar";
import BossEditor from "../components/BossEditor";
const normalizeCardKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const messageFor = (error: unknown) =>
  error instanceof ApiError ? error.message : "Debug simulation failed.";

export default function TapTitanDebug() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [currentBoss, setCurrentBoss] = useState<CurrentBoss | null>(null);
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [totalTaps, setTotalTaps] = useState(1);
  const [roundsPerPattern, setRoundsPerPattern] = useState(1);
  const [result, setResult] = useState<DebugSimulationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.players(), api.cards(), api.currentBoss()])
      .then(([loadedPlayers, loadedCards, loadedBoss]) => {
        if (!active) return;
        setPlayers(loadedPlayers);
        setCards(loadedCards);
        setCurrentBoss(loadedBoss);
        setPlayerId(loadedPlayers[0]?.player_id ?? "");
      })
      .catch((reason) => { if (active) setError(messageFor(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!playerId) {
      return;
    }
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setPlayerLoading(true);
      setSelectedCards([]);
      setResult(null);
    });
    api.player(playerId)
      .then((loadedPlayer) => { if (active) setPlayer(loadedPlayer); })
      .catch((reason) => { if (active) setError(messageFor(reason)); })
      .finally(() => { if (active) setPlayerLoading(false); });
    return () => { active = false; };
  }, [playerId]);

  const definitions = useMemo(
    () => new Map(cards.map((card) => [normalizeCardKey(card.id), card] as const)),
    [cards],
  );
  const availableCards = player?.stats?.card_list
    .filter((card) => card.enabled !== false)
    .map((card) => ({ ...card, definition: definitions.get(normalizeCardKey(card.card_id)) }))
    .sort((left, right) => (left.definition?.name ?? left.card_id).localeCompare(right.definition?.name ?? right.card_id))
    ?? [];

  const toggleCard = (cardId: string) => {
    setResult(null);
    setSelectedCards((current) => current.includes(cardId)
      ? current.filter((value) => value !== cardId)
      : current.length < 3 ? [...current, cardId] : current);
  };

  const runSimulation = async () => {
    if (!playerId || !currentBoss || selectedCards.length !== 3 || currentBoss.attackable_parts.length === 0) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.runDebugSimulation({
        player_id: playerId,
        boss_data: currentBoss.boss_data,
        attackable_parts: currentBoss.attackable_parts,
        deck: selectedCards,
        total_taps: totalTaps,
        rounds_per_pattern: roundsPerPattern,
      }));
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <main className="page-shell debug-sim-page">
        <div className="page-header">
          <span className="eyebrow">Simulation diagnostics</span>
          <h1>Single-deck pattern runner</h1>
          <p>Run one deck against every valid attack pattern. Each round always advances exactly 600 timer ticks.</p>
        </div>
        {error && <div className="error-box debug-sim-error">{error}</div>}
        {loading ? <div className="panel empty-state">Loading debug setup…</div> : (
          <>
            <section className="panel debug-sim-controls">
              <div className="debug-sim-fields">
                <label className="field">
                  <span>Player</span>
                  <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
                    {players.map((entry) => <option key={entry.player_id} value={entry.player_id}>{entry.display_name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Total taps</span>
                  <input type="number" min={1} max={600} value={totalTaps} onChange={(event) => { setTotalTaps(Math.min(600, Math.max(1, event.currentTarget.valueAsNumber || 1))); setResult(null); }} />
                  <small>One tap on each of the first {totalTaps} {totalTaps === 1 ? "tick" : "ticks"}; all 600 timer ticks still run.</small>
                </label>
                <label className="field">
                  <span>Rounds per pattern</span>
                  <input type="number" min={1} max={100} value={roundsPerPattern} onChange={(event) => { setRoundsPerPattern(Math.min(100, Math.max(1, event.currentTarget.valueAsNumber || 1))); setResult(null); }} />
                  <small>Each attack pattern is independently repeated this many times.</small>
                </label>
              </div>
            </section>

            {currentBoss && <div className="section-gap"><BossEditor value={currentBoss} onChange={(value) => { setCurrentBoss(value); setResult(null); }} mode="debug" /></div>}

            <section className="panel section-gap">
              <div className="panel-heading-row">
                <div><h2 className="panel-title">Select exactly 3 cards</h2><p className="panel-desc">{selectedCards.length}/3 selected</p></div>
                <button className="calc-btn" type="button" disabled={running || playerLoading || selectedCards.length !== 3 || !currentBoss || currentBoss.attackable_parts.length === 0} onClick={runSimulation}>{running ? "Running all patterns…" : "Run debug simulation"}</button>
              </div>
              {playerLoading ? <div className="empty-state compact-empty">Loading player cards…</div> : !player?.stats ? <div className="notice-box">This player has no saved stats.</div> : (
                <div className="debug-card-picker">
                  {availableCards.map((card) => {
                    const selected = selectedCards.includes(card.card_id);
                    const name = card.definition?.name ?? card.card_id;
                    return <button key={card.card_id} type="button" className={`debug-card-choice${selected ? " selected" : ""}`} aria-pressed={selected} onClick={() => toggleCard(card.card_id)} title={`${name}, level ${card.level}`}>
                      {card.definition?.image ? <img src={assetUrl(card.definition.image)} alt={name} /> : <span>?</span>}
                      <small>Lv {card.level}</small>
                    </button>;
                  })}
                </div>
              )}
            </section>

            {result && <section className="panel section-gap">
              <div className="panel-heading-row">
                <div><h2 className="panel-title">All pattern results</h2><p className="panel-desc">{result.result.total_attack_patterns} patterns · {result.rounds_per_pattern} rounds each · {result.ticks_per_round} ticks · {result.total_taps} total taps</p></div>
              </div>
              <div className="debug-pattern-table-wrap">
                <table className="debug-pattern-table">
                  <thead><tr><th>Pattern</th><th>Average</th><th>Lowest</th><th>Highest</th><th>Card damage</th></tr></thead>
                  <tbody>{(result.result.patterns ?? []).map((pattern) => <tr key={pattern.pattern}>
                    <td>{pattern.pattern}</td><td>{pattern.average_damage_display}</td><td>{pattern.lowest_round_damage_display}</td><td>{pattern.highest_round_damage_display}</td>
                    <td>{pattern.card_damage?.map((card) => `${card.card_name}: ${card.average_damage_display}`).join(" · ") ?? "—"}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>}
          </>
        )}
      </main>
    </div>
  );
}
