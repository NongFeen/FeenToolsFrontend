import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type {
  CardDefinition,
  CurrentBoss,
  PlayerDetail,
  Recommendation,
  SimulationJob,
} from "../api/types";
import JobStatus from "../components/JobStatus";
import Navbar from "../components/Navbar";
import RecommendationDecks from "../components/RecommendationDecks";
import { usePolling } from "../hooks/usePolling";
import { useRaidMoraleDefault } from "../hooks/useRaidMoraleDefault";
import { isActiveJob } from "../utils/taptitan";

const DEFAULT_DECK_COUNT = 6;
const MAX_DECK_COUNT = 14;
const deckCountOptions = Array.from(
  { length: MAX_DECK_COUNT },
  (_, index) => index + 1,
);
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;
const clampPercent = (value: number, maximum: number) =>
  Number.isFinite(value) ? Math.min(maximum, Math.max(0, value)) : 0;

export default function PlayerRecommendations() {
  const { playerId = "" } = useParams();
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [boss, setBoss] = useState<CurrentBoss | null>(null);
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [latestJob, setLatestJob] = useState<SimulationJob | null>(null);
  const [jobsReady, setJobsReady] = useState(false);
  const [deckCount, setDeckCount] = useState(DEFAULT_DECK_COUNT);
  const [mustIncludeMirrorForce, setMustIncludeMirrorForce] = useState(true);
  const [mustIncludeTeamTactics, setMustIncludeTeamTactics] = useState(true);
  const [recommendationMode, setRecommendationMode] = useState<"current" | "combined">("current");
  const [moralePercent, setMoralePercent] = useState(0);
  const setEditableMoralePercent = useRaidMoraleDefault(setMoralePercent);
  const [loyaltyPercent, setLoyaltyPercent] = useState(34);
  const [recommendations, setRecommendations] = useState<
    Record<string, Recommendation | null>
  >({});
  const [recommendationErrors, setRecommendationErrors] = useState<
    Record<string, string>
  >({});
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [generatingRecommendation, setGeneratingRecommendation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [bossError, setBossError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const completedJobRef = useRef("");
  const recommendationRequestRef = useRef(0);
  const recommendationsInitializedRef = useRef(false);
  const generatedDeckCountsRef = useRef(new Set<string>());
  const pendingScrollPositionRef = useRef<number | null>(null);
  const damageMultiplier = (1 + moralePercent / 100) * (1 + loyaltyPercent / 100);
  const includeBodyPhase = recommendationMode === "combined";
  const recommendationKey = `${deckCount}:${recommendationMode}`;

  const loadRecommendations = useCallback(async (preserveExisting = false) => {
    const requestId = ++recommendationRequestRef.current;
    if (!recommendationsInitializedRef.current) {
      setRecommendationsLoading(true);
    }
    try {
      let recommendation: Recommendation;
      try {
        recommendation = await api.recommendation(
          playerId,
          deckCount,
          mustIncludeMirrorForce,
          mustIncludeTeamTactics,
          includeBodyPhase,
        );
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }
        if (recommendationRequestRef.current !== requestId) return;
        if (!generatedDeckCountsRef.current.has(recommendationKey)) {
          setGeneratingRecommendation(true);
          await api.generateRecommendations(playerId, deckCount, includeBodyPhase);
          if (recommendationRequestRef.current !== requestId) return;
          generatedDeckCountsRef.current.add(recommendationKey);
        }
        recommendation = await api.recommendation(
          playerId,
          deckCount,
          mustIncludeMirrorForce,
          mustIncludeTeamTactics,
          includeBodyPhase,
        );
      }
      if (recommendationRequestRef.current !== requestId) return;
      if (includeBodyPhase && !recommendation.body_phase_ran) {
        throw new ApiError("The selected simulation did not run the Targeted Body phase.", 409);
      }
      generatedDeckCountsRef.current.add(recommendationKey);

      pendingScrollPositionRef.current = window.scrollY;
      setRecommendations((current) => ({
        ...current,
        [recommendationKey]: recommendation,
      }));
      setRecommendationErrors((current) => ({ ...current, [recommendationKey]: "" }));
    } catch (error) {
      if (recommendationRequestRef.current !== requestId) return;

      pendingScrollPositionRef.current = window.scrollY;
      if (!preserveExisting) {
        setRecommendations((current) => ({ ...current, [recommendationKey]: null }));
      }
      setRecommendationErrors((current) => ({
        ...current,
        [recommendationKey]:
          error instanceof ApiError && error.status === 404
            ? ""
            : errorMessage(
                error,
                `Could not load ${deckCount}-deck recommendations.`,
              ),
      }));
    } finally {
      if (recommendationRequestRef.current === requestId) {
        recommendationsInitializedRef.current = true;
        setRecommendationsLoading(false);
        setGeneratingRecommendation(false);
      }
    }
  }, [deckCount, includeBodyPhase, mustIncludeMirrorForce, mustIncludeTeamTactics, playerId, recommendationKey]);

  const refreshCurrentData = useCallback(async () => {
    setRefreshing(true);
    setRefreshError("");
    const [jobsResult, bossResult] = await Promise.allSettled([
      api.playerJobs(playerId),
      api.simsBoss(),
    ]);

    if (bossResult.status === "fulfilled") {
      setBoss(bossResult.value);
      setBossError("");
    } else {
      setRefreshError(errorMessage(bossResult.reason, "Could not refresh Sims Boss data."));
    }

    if (jobsResult.status === "fulfilled") {
      const newest = jobsResult.value[0] ?? null;
      setLatestJob(newest);
      setJobsReady(true);
      if (newest?.status === "completed") {
        completedJobRef.current = newest.id;
        generatedDeckCountsRef.current.clear();
        await loadRecommendations(true);
      }
    } else {
      setJobsReady(true);
      setRefreshError((current) =>
        current || errorMessage(jobsResult.reason, "Could not refresh simulation status."),
      );
    }
    setRefreshing(false);
  }, [loadRecommendations, playerId]);

  useLayoutEffect(() => {
    const scrollPosition = pendingScrollPositionRef.current;
    if (scrollPosition === null) return;
    pendingScrollPositionRef.current = null;
    window.scrollTo(0, scrollPosition);
  }, [recommendationErrors, recommendations]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      setPageError("");
      setBossError("");
      setJobsReady(false);
      completedJobRef.current = "";
      recommendationsInitializedRef.current = false;
      generatedDeckCountsRef.current.clear();
      pendingScrollPositionRef.current = null;
      setRecommendationsLoading(true);
    });
    Promise.allSettled([api.player(playerId), api.simsBoss(), api.cards()]).then(
      ([playerResult, bossResult, cardsResult]) => {
        if (!active) return;
        if (playerResult.status === "fulfilled") setPlayer(playerResult.value);
        else setPageError(errorMessage(playerResult.reason, "Could not load this player."));
        if (bossResult.status === "fulfilled") setBoss(bossResult.value);
        else setBossError(errorMessage(bossResult.reason, "No sims boss data is available."));
        if (cardsResult.status === "fulfilled") setCards(cardsResult.value);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [playerId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadRecommendations();
    });
    return () => {
      active = false;
    };
  }, [loadRecommendations]);

  usePolling({
    enabled: Boolean(playerId) && (!jobsReady || isActiveJob(latestJob)),
    load: () => api.playerJobs(playerId),
    onData: (jobs) => {
      const newest = jobs[0] ?? null;
      setLatestJob(newest);
      setJobsReady(true);
      if (newest?.status === "completed" && completedJobRef.current !== newest.id) {
        completedJobRef.current = newest.id;
        generatedDeckCountsRef.current.clear();
        void loadRecommendations(true);
      }
    },
    onError: () => setJobsReady(true),
  });

  if (loading) {
    return (
      <div className="page">
        <Navbar />
        <main className="page-shell">
          <div className="panel empty-state">Loading player recommendation…</div>
        </main>
      </div>
    );
  }
  if (pageError || !player) {
    return (
      <div className="page">
        <Navbar />
        <main className="page-shell narrow-shell">
          <div className="error-box standalone-error">
            <h2>Player unavailable</h2>
            <p>{pageError || "Player not found."}</p>
            <Link to="/tools/taptitan">Back to players</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <main className="page-shell">
        <Link className="back-link" to="/tools/taptitan">
          ← All players
        </Link>
        <header className="profile-header panel">
          <div className="player-avatar large" aria-hidden="true">
            {player.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="profile-main">
            <span className="eyebrow">Player recommendation</span>
            <h1>{player.display_name}</h1>
            <p>{player.player_id}</p>
          </div>
          <dl className="profile-facts">
            <div><dt>Stats revision</dt><dd>{player.stats_revision ?? "Missing"}</dd></div>
            <div><dt>Auto sims</dt><dd>{player.auto_sims ? "Enabled" : "Disabled"}</dd></div>
            <div><dt>Sims boss</dt><dd>{boss?.boss_data.boss_name ?? "Missing"}</dd></div>
          </dl>
        </header>

        {!player.stats && (
          <div className="notice-box">
            This player has no current stats. Import and save stats in Admin before running a simulation.
          </div>
        )}
        {bossError && <div className="notice-box">{bossError}</div>}
        <section className="panel section-gap">
          <div className="panel-heading-row simulation-status-heading">
            <div>
              <h2 className="panel-title">Simulation status</h2>
              <p className="panel-desc">Refresh to check for a newly queued automatic simulation.</p>
            </div>
            <button
              type="button"
              className="calc-btn"
              onClick={() => void refreshCurrentData()}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {refreshError && <div className="error-box inline-refresh-error">{refreshError}</div>}
          <JobStatus job={latestJob} />
          {latestJob?.status === "failed" && (
            <p className="muted-copy">
              Fix the player stats or boss configuration, then force a new run from Admin.
            </p>
          )}
        </section>

        <section className="panel section-gap recommendations-panel">
          <div className="panel-heading-row">
            <div>
              <h2 className="panel-title">Best raid decks</h2>
              <p className="panel-desc">Cards are unique across the optimized lineup.</p>
            </div>
            <div className="recommendation-controls">
              <div className="recommendation-mode-control" role="group" aria-label="Simulation phase recommendation">
                <button type="button" className={recommendationMode === "current" ? "selected" : ""} onClick={() => setRecommendationMode("current")}>Current boss only</button>
                <button type="button" className={recommendationMode === "combined" ? "selected" : ""} onClick={() => setRecommendationMode("combined")}>Current + Body/Void phase</button>
              </div>
              <div className="damage-modifier-controls">
                <label className="damage-percent-control">
                  <span>Morale %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={moralePercent}
                    onChange={(event) => setEditableMoralePercent(clampPercent(event.currentTarget.valueAsNumber, 100))}
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
                    onChange={(event) => setLoyaltyPercent(clampPercent(event.currentTarget.valueAsNumber, 34))}
                  />
                </label>
              </div>
              <label className="required-cards-toggle">
                <input
                  type="checkbox"
                  checked={mustIncludeMirrorForce}
                  onChange={(event) => setMustIncludeMirrorForce(event.target.checked)}
                />
                <span>Must include Mirror Force</span>
              </label>
              <label className="required-cards-toggle">
                <input
                  type="checkbox"
                  checked={mustIncludeTeamTactics}
                  onChange={(event) => setMustIncludeTeamTactics(event.target.checked)}
                />
                <span>Must include Team Tactics</span>
              </label>
              <label className="deck-count-control">
                <span>Number of decks</span>
                <select
                  value={deckCount}
                  onChange={(event) => setDeckCount(Number(event.target.value))}
                >
                  {deckCountOptions.map((count) => (
                    <option key={count} value={count}>
                      Best {count} {count === 1 ? "deck" : "decks"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <RecommendationDecks
            recommendation={recommendations[recommendationKey] ?? null}
            cards={cards}
            playerCards={player.stats?.card_list ?? []}
            loading={
              (recommendationsLoading || generatingRecommendation)
              && !recommendations[recommendationKey]
            }
            error={recommendationErrors[recommendationKey] ?? ""}
            damageMultiplier={damageMultiplier}
            moralePercent={moralePercent}
            loyaltyPercent={loyaltyPercent}
            emptyMessage={
              generatingRecommendation
                ? `Generating the best ${deckCount}-deck recommendations from the selected simulation mode...`
                : recommendationMode === "combined"
                  ? "No recommendation from a completed Targeted Body phase simulation is available."
                : mustIncludeMirrorForce || mustIncludeTeamTactics
                  ? `No compatible ${deckCount}-deck recommendation containing the selected required cards is available.`
                  : `No compatible ${deckCount}-deck recommendation is available.`
            }
          />
        </section>
      </main>
    </div>
  );
}
