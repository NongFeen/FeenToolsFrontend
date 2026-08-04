import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { CardDefinition, CurrentBoss, PlayerRaidData, PlayerSummary, SimulationJob } from "../api/types";
import BossEditor from "../components/BossEditor";
import JobStatus from "../components/JobStatus";
import Navbar from "../components/Navbar";
import StatsEditor from "../components/StatsEditor";
import { usePolling } from "../hooks/usePolling";
import { isActiveJob, makeDefaultBoss } from "../utils/taptitan";

const messageFor = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;

export default function TapTitanAdmin() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [stats, setStats] = useState<PlayerRaidData | null>(null);
  const [boss, setBoss] = useState<CurrentBoss>(makeDefaultBoss);
  const [createForm, setCreateForm] = useState({ player_id: "", display_name: "", auto_sims: false });
  const [rawInput, setRawInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forceJobId, setForceJobId] = useState("");
  const [forceJob, setForceJob] = useState<SimulationJob | null>(null);
  const [forceError, setForceError] = useState("");

  const refreshPlayers = useCallback(async () => {
    const list = await api.players();
    setPlayers(list);
    return list;
  }, []);

  useEffect(() => {
    let active = true;
    Promise.allSettled([api.players(), api.cards(), api.currentBoss()]).then(([playersResult, cardsResult, bossResult]) => {
      if (!active) return;
      if (playersResult.status === "fulfilled") setPlayers(playersResult.value);
      else setError(messageFor(playersResult.reason, "Could not load players."));
      if (cardsResult.status === "fulfilled") setCards(cardsResult.value);
      else setError(messageFor(cardsResult.reason, "Could not load card definitions."));
      if (bossResult.status === "fulfilled") setBoss(bossResult.value);
      else if (!(bossResult.reason instanceof ApiError && bossResult.reason.status === 404)) setError(messageFor(bossResult.reason, "Could not load current boss."));
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

  usePolling({
    enabled: Boolean(forceJobId) && (!forceJob || isActiveJob(forceJob)),
    load: () => api.internalJob(forceJobId),
    onData: (job) => { setForceJob(job); if (job.status === "completed") setNotice("Selected-player simulation completed. Recommendations are ready."); },
    onError: (reason) => setForceError(messageFor(reason, "Could not refresh simulation status.")),
  });

  const resetMessages = () => { setError(""); setNotice(""); };
  const selectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setStats(null);
    setStatsLoading(Boolean(playerId));
    resetMessages();
  };

  const createPlayer = async (event: React.FormEvent) => {
    event.preventDefault(); resetMessages(); setBusy("create");
    try {
      const created = await api.createPlayer({ ...createForm, player_id: createForm.player_id.trim(), display_name: createForm.display_name.trim() });
      await refreshPlayers(); setCreateForm({ player_id: "", display_name: "", auto_sims: false }); selectPlayer(created.player_id); setNotice(`${created.display_name} was created.`);
    } catch (reason) { setError(messageFor(reason, "Could not create player.")); }
    finally { setBusy(""); }
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
    try { const saved = await api.updateStats(selectedPlayerId, stats); setStats(saved.stats); await refreshPlayers(); setNotice(`Stats saved as revision ${saved.revision}.`); }
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
    try { const accepted = await api.createSimulation(selectedPlayerId); setForceJob(null); setForceJobId(accepted.job_id); setNotice(accepted.created ? "Simulation queued for the selected player." : "An existing selected-player simulation is being tracked."); }
    catch (reason) { setError(messageFor(reason, "Could not start the selected-player simulation.")); }
    finally { setBusy(""); }
  };

  const selected = players.find((player) => player.player_id === selectedPlayerId);
  if (loading) return <div className="page"><Navbar /><main className="page-shell"><div className="panel empty-state">Loading admin tools…</div></main></div>;

  return (
    <div className="page">
      <Navbar />
      <div className="layout admin-layout">
        <aside className="sidebar admin-sidebar" aria-label="Admin sections">
          <p className="sidebar-label">Admin</p>
          {[ ["section-players", "Players"], ["section-import", "Import stats"], ["section-multipliers", "Multipliers"], ["section-titan-soul", "Titan Soul"], ["section-raid-card", "Raid Card"], ["section-gem-stone", "Gem Stone"], ["section-card-vault", "Card Vault"], ["section-boss", "Current Boss"], ["section-simulation", "Simulation"] ].map(([id, label]) => <button key={id} className="side-btn" type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })}>{label}</button>)}
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
              <label className="check-row form-check"><input type="checkbox" checked={createForm.auto_sims} onChange={(event) => setCreateForm({ ...createForm, auto_sims: event.target.checked })} /><span>Auto simulations</span></label>
              <button className="calc-btn" disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create player"}</button>
            </form>
            <div className="selection-row">
              <label className="field"><span>Existing player</span><select value={selectedPlayerId} onChange={(event) => selectPlayer(event.target.value)}><option value="">Select a player…</option>{players.map((player) => <option key={player.player_id} value={player.player_id}>{player.display_name}</option>)}</select></label>
              <button className="secondary-btn" type="button" disabled={!selected || busy === "auto"} onClick={toggleAutoSims}>{selected ? `Auto sims: ${selected.auto_sims ? "On" : "Off"}` : "Auto sims"}</button>
            </div>
          </section>

          <section id="section-import" className="panel scroll-target section-gap">
            <h2 className="panel-title">Import Player Data</h2><p className="panel-desc">Paste a raw Tap Titans 2 export. It is converted into the detailed editor for the selected existing player.</p>
            <textarea className="code-area" rows={10} spellCheck={false} value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder={'{\n  "playerStats": { ... },\n  "raidCards": { ... }\n}'} />
            <button className="calc-btn" type="button" disabled={!selectedPlayerId || !rawInput.trim() || busy === "import"} onClick={importRawData}>{busy === "import" ? "Converting…" : "Parse and clean input"}</button>
          </section>

          {statsLoading && <div className="panel empty-state section-gap">Loading selected player stats…</div>}
          {!statsLoading && stats && <><div className="save-bar"><div><strong>Editing {selected?.display_name}</strong><span>Changes remain local until saved.</span></div><button className="calc-btn" type="button" disabled={busy === "stats"} onClick={saveStats}>{busy === "stats" ? "Saving…" : "Save player stats"}</button></div><StatsEditor data={stats} cardDefinitions={cards} onChange={setStats} /></>}
          {!statsLoading && selectedPlayerId && !stats && <div className="panel empty-state section-gap">No cleaned stats loaded. Paste a raw export above.</div>}

          <div className="section-gap"><BossEditor value={boss} onChange={setBoss} onSave={saveBoss} saving={busy === "boss"} /></div>
          <section id="section-simulation" className="panel scroll-target section-gap">
            <div className="panel-heading-row"><div><h2 className="panel-title">Selected-player Simulation</h2><p className="panel-desc">Force a simulation for only the selected player. Status refreshes every two seconds.</p></div><button className="calc-btn" type="button" disabled={!selectedPlayerId || busy === "force"} onClick={forceSimulation}>{busy === "force" ? "Queueing…" : "Force selected player run"}</button></div>
            {forceError && <div className="error-box">{forceError}</div>}
            <JobStatus job={forceJob} emptyMessage={forceJobId ? "Loading queued job…" : "No manually forced simulation in this session."} />
          </section>
        </main>
      </div>
    </div>
  );
}
