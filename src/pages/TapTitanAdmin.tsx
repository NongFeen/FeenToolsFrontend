import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { CardDefinition, CurrentBoss, PlayerRaidData, PlayerSummary, SimulationBatch, SimulationJob, Tt2ClanStatus, Tt2PlayerStatus } from "../api/types";
import BossEditor from "../components/BossEditor";
import JobStatus from "../components/JobStatus";
import Navbar from "../components/Navbar";
import StatsEditor from "../components/StatsEditor";
import { usePolling } from "../hooks/usePolling";
import { isActiveJob, makeDefaultBoss } from "../utils/taptitan";

const messageFor = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;
const BATCH_STORAGE_KEY = "taptitan.latestSimulationBatchId";
const formatDuration = (milliseconds: number) => {
  const seconds = milliseconds / 1_000;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${(seconds - minutes * 60).toFixed(1)}s`;
};

export default function TapTitanAdmin() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [stats, setStats] = useState<PlayerRaidData | null>(null);
  const [boss, setBoss] = useState<CurrentBoss>(makeDefaultBoss);
  const [createForm, setCreateForm] = useState({ player_id: "", display_name: "", player_token: "", auto_sims: false });
  const [playerToken, setPlayerToken] = useState("");
  const [tt2Status, setTt2Status] = useState<Tt2PlayerStatus>({ configured: false, connected: false, raid_connected: false });
  const [tt2ClanStatus, setTt2ClanStatus] = useState<Tt2ClanStatus | null>(null);
  const [elapsedClanCooldown, setElapsedClanCooldown] = useState<string | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forceJobId, setForceJobId] = useState("");
  const [forceJob, setForceJob] = useState<SimulationJob | null>(null);
  const [forceError, setForceError] = useState("");
  const [simulationPlayerIds, setSimulationPlayerIds] = useState<string[]>([]);
  const [includeBodyPhase, setIncludeBodyPhase] = useState(false);
  const [simulationBatchId, setSimulationBatchId] = useState(() => window.localStorage.getItem(BATCH_STORAGE_KEY) ?? "");
  const [simulationBatch, setSimulationBatch] = useState<SimulationBatch | null>(null);

  const refreshPlayers = useCallback(async () => {
    const list = await api.players();
    setPlayers(list);
    return list;
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.players(), api.cards(), api.currentBoss(), api.tt2PlayerStatus(), api.tt2ClanStatus()]).then(([playersResult, cardsResult, bossResult, tt2Result, clanStatusResult]) => {
      if (!active) return;
      if (playersResult.status === "fulfilled") setPlayers(playersResult.value);
      else setError(messageFor(playersResult.reason, "Could not load players."));
      if (cardsResult.status === "fulfilled") setCards(cardsResult.value);
      else setError(messageFor(cardsResult.reason, "Could not load card definitions."));
      if (bossResult.status === "fulfilled") setBoss({
        ...bossResult.value,
        boss_data: {
          ...bossResult.value.boss_data,
          global_raid_modifier: bossResult.value.boss_data.global_raid_modifier ?? "None",
          global_raid_modifier_amount: bossResult.value.boss_data.global_raid_modifier_amount ?? null,
          curse_damage_per_curse: bossResult.value.boss_data.curse_damage_per_curse ?? 0.06,
        },
      });
      else if (!(bossResult.reason instanceof ApiError && bossResult.reason.status === 404)) setError(messageFor(bossResult.reason, "Could not load current boss."));
      if (tt2Result.status === "fulfilled") setTt2Status(tt2Result.value);
      if (clanStatusResult.status === "fulfilled") setTt2ClanStatus(clanStatusResult.value);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedPlayerId) return;
    let active = true;
    api.currentStats(selectedPlayerId)
      .then((version) => { if (active) setStats({ ...version.stats, title: version.stats.title ?? 0 }); })
      .catch((reason) => {
        if (!active) return;
        setStats(null);
        if (reason instanceof ApiError && reason.status === 404) setNotice("This player has no saved stats. Paste a raw export below to create them.");
        else setError(messageFor(reason, "Could not load player stats."));
      })
      .finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [selectedPlayerId]);

  useEffect(() => {
    if (notice !== "Stats saved.") return;
    const timeoutId = window.setTimeout(() => setNotice(""), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    const nextFetchAt = tt2ClanStatus?.next_fetch_at;
    if (!nextFetchAt) return;
    const delay = Math.max(0, new Date(nextFetchAt).getTime() - Date.now());
    const timeoutId = window.setTimeout(() => setElapsedClanCooldown(nextFetchAt), delay);
    return () => window.clearTimeout(timeoutId);
  }, [tt2ClanStatus?.next_fetch_at]);

  usePolling({
    enabled: Boolean(forceJobId) && (!forceJob || isActiveJob(forceJob)),
    load: () => api.internalJob(forceJobId),
    onData: (job) => { setForceJob(job); if (job.status === "completed") setNotice("Selected-player simulation completed. Recommendations are ready."); },
    onError: (reason) => setForceError(messageFor(reason, "Could not refresh simulation status.")),
  });

  usePolling({
    enabled: Boolean(simulationBatchId) && (!simulationBatch || simulationBatch.status === "running"),
    load: () => api.simulationBatch(simulationBatchId),
    onData: (batch) => {
      setSimulationBatch(batch);
      if (batch.status === "completed") setNotice("Batch simulations and recommendations completed.");
      if (batch.status === "completed_with_failures") setError(`Batch completed with ${batch.failed} failed simulation${batch.failed === 1 ? "" : "s"}.`);
    },
    onError: (reason) => setForceError(messageFor(reason, "Could not refresh batch simulation status.")),
  });

  const resetMessages = () => { setError(""); setNotice(""); };
  const selectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setStats(null);
    setStatsLoading(Boolean(playerId));
    setPlayerToken("");
    resetMessages();
  };

  const createPlayer = async (event: React.FormEvent) => {
    event.preventDefault(); resetMessages(); setBusy("create");
    try {
      const playerToken = createForm.player_token.trim();
      const created = await api.createPlayer({ player_id: createForm.player_id.trim(), display_name: createForm.display_name.trim(), auto_sims: createForm.auto_sims });
      if (playerToken) await api.updatePlayerToken(created.player_id, playerToken);
      await refreshPlayers(); setCreateForm({ player_id: "", display_name: "", player_token: "", auto_sims: false }); selectPlayer(created.player_id); setNotice(`${created.display_name} was created${playerToken ? " with a configured TT2 token" : ""}.`);
    } catch (reason) { setError(messageFor(reason, "Could not create player.")); }
    finally { setBusy(""); }
  };

  const savePlayerToken = async () => {
    resetMessages();
    if (!selectedPlayerId || !playerToken.trim()) { setError("Select a player and enter a player token."); return; }
    setBusy("token");
    try { await api.updatePlayerToken(selectedPlayerId, playerToken.trim()); await refreshPlayers(); setPlayerToken(""); setNotice("Player token configured."); }
    catch (reason) { setError(messageFor(reason, "Could not configure the player token.")); }
    finally { setBusy(""); }
  };

  const clearPlayerToken = async () => {
    resetMessages();
    if (!selectedPlayerId) return;
    setBusy("token");
    try { await api.clearPlayerToken(selectedPlayerId); await refreshPlayers(); setPlayerToken(""); setNotice("Player token cleared."); }
    catch (reason) { setError(messageFor(reason, "Could not clear the player token.")); }
    finally { setBusy(""); }
  };

  const fetchLatestPlayerData = async () => {
    resetMessages();
    if (!selectedPlayerId) return;
    setBusy("fetch");
    try {
      const saved = await api.fetchPlayerStats(selectedPlayerId);
      setStats({ ...saved.stats, title: saved.stats.title ?? 0 });
      await refreshPlayers();
      setNotice("Latest TT2 player data fetched and saved.");
    } catch (reason) {
      setError(messageFor(reason, "Could not fetch the latest TT2 player data."));
      api.tt2PlayerStatus().then(setTt2Status).catch(() => undefined);
    } finally { setBusy(""); }
  };

  const fetchClanPlayerData = async () => {
    resetMessages();
    if (!selectedPlayerId) { setError("Select the clan Master or Grand Master player first."); return; }
    setBusy("fetch-clan");
    try {
      const result = await api.fetchClanStats(selectedPlayerId);
      setTt2ClanStatus({
        clan_code: result.clan_code,
        clan_name: result.clan_name,
        last_fetched_at: result.last_fetched_at,
        next_fetch_at: result.next_fetch_at,
        last_player_count: result.player_count,
      });
      await refreshPlayers();
      try {
        const selectedStats = await api.currentStats(selectedPlayerId);
        setStats({ ...selectedStats.stats, title: selectedStats.stats.title ?? 0 });
      } catch { /* The selected token owner may no longer be returned as a clan member. */ }
      setNotice(`Clan data updated for ${result.clan_name}: ${result.created_players} players created and ${result.updated_players} updated.`);
    } catch (reason) {
      setError(messageFor(reason, "Could not fetch TT2 clan player data."));
      Promise.allSettled([api.tt2PlayerStatus(), api.tt2ClanStatus()]).then(([socketResult, clanResult]) => {
        if (socketResult.status === "fulfilled") setTt2Status(socketResult.value);
        if (clanResult.status === "fulfilled") setTt2ClanStatus(clanResult.value);
      });
    } finally { setBusy(""); }
  };

  const importRawData = async () => {
    resetMessages();
    if (!selectedPlayerId) { setError("Select an existing player before importing stats."); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(rawInput); } catch { setError("The pasted Tap Titans data is not valid JSON."); return; }
    setBusy("import");
    try {
      const response = await api.convertPlayerData(parsed);
      setStats({ ...response.data.data, title: response.data.data.title ?? 0 });
      setNotice("Raw export converted. Review the detailed editor, then save the stats.");
      document.getElementById("section-multipliers")?.scrollIntoView({ behavior: "smooth" });
    } catch (reason) { setError(messageFor(reason, "Could not convert the Tap Titans export.")); }
    finally { setBusy(""); }
  };

  const saveStats = async () => {
    resetMessages();
    if (!selectedPlayerId || !stats) { setError("Select a player and load or import stats first."); return; }
    setBusy("stats");
    try { const saved = await api.updateStats(selectedPlayerId, stats); setStats(saved.stats); await refreshPlayers(); setNotice("Stats saved."); }
    catch (reason) { setError(messageFor(reason, "Could not save player stats.")); }
    finally { setBusy(""); }
  };

  const toggleAutoSims = async () => {
    const selected = players.find((player) => player.player_id === selectedPlayerId);
    if (!selected) return;
    resetMessages(); setBusy("auto");
    try { const updated = await api.updateAutoSims(selectedPlayerId, !selected.auto_sims); setPlayers((current) => current.map((player) => player.player_id === updated.player_id ? updated : player)); setNotice(`Automatic simulations ${updated.auto_sims ? "enabled" : "disabled"} for ${updated.display_name}.`); }
    catch (reason) { setError(messageFor(reason, "Could not update automatic simulations.")); }
    finally { setBusy(""); }
  };

  const saveBoss = async () => {
    resetMessages(); setBusy("boss");
    try { const response = await api.updateBoss(boss.boss_data, boss.attackable_parts); setForceJobId(""); setForceJob(null); setNotice(response.message); }
    catch (reason) { setError(messageFor(reason, "Could not save current boss.")); }
    finally { setBusy(""); }
  };

  const forceSimulation = async () => {
    resetMessages(); setForceError("");
    if (!selectedPlayerId) { setError("Select a player before forcing a simulation."); return; }
    setBusy("force");
    try { const accepted = await api.createSimulation(selectedPlayerId, includeBodyPhase); setForceJob(null); setForceJobId(accepted.job_id); setNotice(accepted.created ? `Simulation queued for the selected player${includeBodyPhase ? " with the targeted Body phase enabled" : ""}.` : "An existing selected-player simulation is being tracked."); }
    catch (reason) { setError(messageFor(reason, "Could not start the selected-player simulation.")); }
    finally { setBusy(""); }
  };

  const simulationEligiblePlayers = players.filter((player) => player.stats_revision !== null);
  const allSimulationPlayersSelected = simulationEligiblePlayers.length > 0
    && simulationEligiblePlayers.every((player) => simulationPlayerIds.includes(player.player_id));

  const toggleSimulationPlayer = (playerId: string, checked: boolean) => {
    setSimulationPlayerIds((current) => checked
      ? [...new Set([...current, playerId])]
      : current.filter((id) => id !== playerId));
  };

  const toggleAllSimulationPlayers = () => {
    setSimulationPlayerIds(allSimulationPlayersSelected
      ? []
      : simulationEligiblePlayers.map((player) => player.player_id));
  };

  const runSelectedPlayerSimulations = async () => {
    resetMessages(); setForceError("");
    const selectedIds = simulationPlayerIds.filter((playerId) =>
      simulationEligiblePlayers.some((player) => player.player_id === playerId));
    if (selectedIds.length === 0) { setError("Select at least one player with saved stats."); return; }
    setBusy("force-all");
    try {
      const accepted = await api.createSimulationBatch(selectedIds, includeBodyPhase);
      setSimulationBatchId(accepted.batch_id);
      setSimulationBatch(null);
      window.localStorage.setItem(BATCH_STORAGE_KEY, accepted.batch_id);
      setNotice(`${accepted.queued} simulation${accepted.queued === 1 ? "" : "s"} queued in one batch${accepted.existing > 0 ? `; ${accepted.existing} existing job${accepted.existing === 1 ? "" : "s"} tracked` : ""}.`);
    } catch (reason) {
      setError(messageFor(reason, "Could not create the simulation batch."));
    } finally { setBusy(""); }
  };

  const selected = players.find((player) => player.player_id === selectedPlayerId);
  const clanNextFetchAt = tt2ClanStatus?.next_fetch_at ? new Date(tt2ClanStatus.next_fetch_at) : null;
  const clanFetchCoolingDown = Boolean(tt2ClanStatus?.next_fetch_at && elapsedClanCooldown !== tt2ClanStatus.next_fetch_at);
  if (loading) return <div className="page"><Navbar /><main className="page-shell"><div className="panel empty-state">Loading admin tools…</div></main></div>;

  return (
    <div className="page">
      <Navbar />
      <div className="layout admin-layout">
        <aside className="sidebar admin-sidebar" aria-label="Admin sections">
          <p className="sidebar-label">Admin</p>
          {[ ["section-players", "Players"], ["section-boss", "Current Boss"], ["section-simulation", "Simulation"], ["section-import", "Import stats"], ["section-multipliers", "Multipliers"], ["section-titan-soul", "Titan Soul"], ["section-raid-card", "Raid Card"], ["section-gem-stone", "Gem Stone"], ["section-card-vault", "Card Vault"] ].map(([id, label]) => <button key={id} className="side-btn" type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}>{label}</button>)}
        </aside>
        <main className="content">
          <div className="page-header admin-heading"><span className="eyebrow">Local debug controls</span><h1>Tap Titans Admin</h1><p>Create players and manage current-state stats, boss data, and simulations.</p></div>
          {error && <div className="error-box sticky-message" role="alert">{error}</div>}
          {notice && <div className="success-box sticky-message" role="status">{notice}</div>}

          <section id="section-players" className="panel scroll-target">
            <h2 className="panel-title">Players</h2><p className="panel-desc">Create a player, then select an existing player for every stats or simulation action.</p>
            <form className="create-player-form" onSubmit={createPlayer}>
              <label className="field"><span>Player ID</span><input required value={createForm.player_id} onChange={(event) => setCreateForm({ ...createForm, player_id: event.target.value })} placeholder="933qd64" /></label>
              <label className="field"><span>Display name</span><input required value={createForm.display_name} onChange={(event) => setCreateForm({ ...createForm, display_name: event.target.value })} placeholder="Feen" /></label>
              <label className="field"><span>Player token (optional)</span><input type="password" autoComplete="off" value={createForm.player_token} onChange={(event) => setCreateForm({ ...createForm, player_token: event.target.value })} placeholder="Stored encrypted; never displayed again" /></label>
              <label className="check-row form-check"><input type="checkbox" checked={createForm.auto_sims} onChange={(event) => setCreateForm({ ...createForm, auto_sims: event.target.checked })} /><span>Auto simulations</span></label>
              <button className="calc-btn" disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create player"}</button>
            </form>
            <div className="selection-row">
              <label className="field"><span>Existing player</span><select value={selectedPlayerId} onChange={(event) => selectPlayer(event.target.value)}><option value="">Select a player…</option>{players.map((player) => <option key={player.player_id} value={player.player_id}>{player.display_name}</option>)}</select></label>
              <button className="secondary-btn" type="button" disabled={!selected || busy === "auto"} onClick={toggleAutoSims}>{selected ? `Auto sims: ${selected.auto_sims ? "On" : "Off"}` : "Auto sims"}</button>
            </div>
            {selected && <div className="selection-row section-gap">
              <label className="field"><span>TT2 player token — {selected.player_token_status === "configured" ? "Configured" : selected.player_token_status === "invalid" ? "Invalid" : "Missing"}</span><input type="password" autoComplete="off" value={playerToken} onChange={(event) => setPlayerToken(event.target.value)} placeholder={selected.has_player_token ? "Enter a replacement token" : "Enter player token"} /></label>
              <button className="secondary-btn" type="button" disabled={!playerToken.trim() || busy === "token"} onClick={savePlayerToken}>{busy === "token" ? "Updating…" : selected.has_player_token ? "Replace token" : "Save token"}</button>
              <button className="secondary-btn" type="button" disabled={!selected.has_player_token || busy === "token"} onClick={clearPlayerToken}>Clear token</button>
            </div>}
          </section>

          <div className="section-gap"><BossEditor value={boss} onChange={setBoss} onSave={saveBoss} saving={busy === "boss"} /></div>
          <section id="section-simulation" className="panel scroll-target section-gap">
            <div className="panel-heading-row"><div><h2 className="panel-title">Selected-player Simulation</h2><p className="panel-desc">Force a simulation for only the selected player. Status refreshes every two seconds.</p></div><button className="calc-btn" type="button" disabled={!selectedPlayerId || busy === "force" || busy === "force-all"} onClick={forceSimulation}>{busy === "force" ? "Queueing…" : "Force selected player run"}</button></div>
            <label className="check-row body-phase-option"><input type="checkbox" checked={includeBodyPhase} disabled={busy === "force" || busy === "force-all"} onChange={(event) => setIncludeBodyPhase(event.target.checked)} /><span>Also simulate targeted parts as Body</span></label>
            <div className="batch-simulation-section">
              <div className="batch-simulation-heading">
                <div><h3>Run multiple players</h3><p className="panel-desc">Select players with saved stats, then queue one simulation for each.</p></div>
                <div className="batch-simulation-actions">
                  <button className="secondary-btn" type="button" disabled={simulationEligiblePlayers.length === 0 || busy === "force-all" || busy === "force"} onClick={toggleAllSimulationPlayers}>{allSimulationPlayersSelected ? "Clear all" : "Select all players"}</button>
                  <button className="calc-btn" type="button" disabled={simulationPlayerIds.length === 0 || busy === "force-all" || busy === "force"} onClick={runSelectedPlayerSimulations}>{busy === "force-all" ? "Queueing players…" : `Run selected players (${simulationPlayerIds.length})`}</button>
                </div>
              </div>
              <div className="simulation-player-list">
                {players.map((player) => {
                  const canSimulate = player.stats_revision !== null;
                  return (
                    <label key={player.player_id} className={`simulation-player-option${canSimulate ? "" : " disabled"}`}>
                      <input type="checkbox" disabled={!canSimulate || busy === "force-all" || busy === "force"} checked={canSimulate && simulationPlayerIds.includes(player.player_id)} onChange={(event) => toggleSimulationPlayer(player.player_id, event.target.checked)} />
                      <span><strong>{player.display_name}</strong><small>{canSimulate ? player.player_id : "No saved stats"}</small></span>
                    </label>
                  );
                })}
                {players.length === 0 && <p className="panel-desc">No players are available.</p>}
              </div>
              {simulationBatch && (
                <div className={`simulation-batch-status status-${simulationBatch.status}`} role="status" aria-live="polite">
                  <div className="batch-status-heading">
                    <strong>Batch {simulationBatch.status.replaceAll("_", " ")}</strong>
                    <span>{simulationBatch.completed + simulationBatch.failed} / {simulationBatch.tracked} players finished</span>
                  </div>
                  <dl className="batch-timing-grid">
                    <div><dt>Simulation compute</dt><dd>{formatDuration(simulationBatch.simulation_time_ms)}</dd></div>
                    <div><dt>Recommendation compute</dt><dd>{formatDuration(simulationBatch.recommendation_time_ms)}</dd></div>
                    <div><dt>Combined compute</dt><dd>{formatDuration(simulationBatch.combined_processing_time_ms)}</dd></div>
                    <div><dt>Batch wall time</dt><dd>{formatDuration(simulationBatch.wall_time_ms)}</dd></div>
                  </dl>
                  <small>{simulationBatch.pending} pending · {simulationBatch.running} simulating · {simulationBatch.optimizing} generating recommendations · {simulationBatch.failed} failed</small>
                </div>
              )}
            </div>
            {forceError && <div className="error-box">{forceError}</div>}
            <JobStatus job={forceJob} emptyMessage={forceJobId ? "Loading queued job…" : "No manually forced simulation in this session."} />
          </section>

          <section className="panel scroll-target section-gap">
            <div className="panel-heading-row"><div><h2 className="panel-title">Latest TT2 Player Data</h2><p className="panel-desc">Socket: {tt2Status.connected ? "Connected" : tt2Status.configured ? "Disconnected" : "Not configured"}. Fetching immediately converts and saves a new stats revision.</p></div><button className="calc-btn" type="button" disabled={!selected || !selected.has_player_token || selected.player_token_status === "invalid" || !tt2Status.connected || busy === "fetch"} onClick={fetchLatestPlayerData}>{busy === "fetch" ? "Fetching…" : "Fetch latest player data"}</button></div>
            {selected?.tt2_last_fetched_at && <p className="panel-desc">Last fetch attempt: {new Date(selected.tt2_last_fetched_at).toLocaleString()}</p>}
          </section>

          <section className="panel scroll-target section-gap">
            <div className="panel-heading-row">
              <div>
                <h2 className="panel-title">TT2 Clan Player Data</h2>
                <p className="panel-desc">Select a clan Master or Grand Master with a configured token. This creates missing clan players and refreshes every returned player’s stats.</p>
              </div>
              <button
                className="calc-btn"
                type="button"
                disabled={!selected || !selected.has_player_token || selected.player_token_status === "invalid" || !tt2Status.raid_connected || clanFetchCoolingDown || busy === "fetch-clan"}
                onClick={fetchClanPlayerData}
              >
                {busy === "fetch-clan" ? "Fetching clan…" : "Fetch clan player data"}
              </button>
            </div>
            <div className="clan-fetch-status">
              <span>Raid socket: <strong>{tt2Status.raid_connected ? "Connected" : tt2Status.configured ? "Disconnected" : "Not configured"}</strong></span>
              {tt2ClanStatus?.clan_name && <span>Last clan: <strong>{tt2ClanStatus.clan_name} ({tt2ClanStatus.clan_code})</strong></span>}
              {tt2ClanStatus?.last_fetched_at && <span>Last update: <strong>{new Date(tt2ClanStatus.last_fetched_at).toLocaleString()}</strong> ({tt2ClanStatus.last_player_count} players)</span>}
              {clanFetchCoolingDown && clanNextFetchAt && <span>Available again: <strong>{clanNextFetchAt.toLocaleString()}</strong></span>}
            </div>
          </section>

          <section id="section-import" className="panel scroll-target section-gap">
            <h2 className="panel-title">Fallback: Import Player Data</h2><p className="panel-desc">Paste a raw Tap Titans 2 export only when the public API fetch is unavailable. It is converted into the editor before saving.</p>
            <textarea className="code-area" rows={10} spellCheck={false} value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder={'{\n  "playerStats": { ... },\n  "raidCards": { ... }\n}'} />
            <button className="calc-btn" type="button" disabled={!selectedPlayerId || !rawInput.trim() || busy === "import"} onClick={importRawData}>{busy === "import" ? "Converting…" : "Parse and clean input"}</button>
          </section>

          {statsLoading && <div className="panel empty-state section-gap">Loading selected player stats…</div>}
          {!statsLoading && stats && <><div className="save-bar"><div><strong>Editing {selected?.display_name}</strong><span>Changes remain local until saved.</span></div><button className="calc-btn" type="button" disabled={busy === "stats"} onClick={saveStats}>{busy === "stats" ? "Saving…" : "Save player stats"}</button></div><StatsEditor data={stats} cardDefinitions={cards} onChange={setStats} /></>}
          {!statsLoading && selectedPlayerId && !stats && <div className="panel empty-state section-gap">No cleaned stats loaded. Paste a raw export above.</div>}

        </main>
      </div>
    </div>
  );
}
