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
import { isActiveJob } from "../utils/taptitan";

type DeckCount = 6 | 9;
const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

export default function PlayerRecommendations() {
  const { playerId = "" } = useParams();
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [boss, setBoss] = useState<CurrentBoss | null>(null);
  const [cards, setCards] = useState<CardDefinition[]>([]);
  const [latestJob, setLatestJob] = useState<SimulationJob | null>(null);
  const [jobsReady, setJobsReady] = useState(false);
  const [tab, setTab] = useState<DeckCount>(6);
  const [mustIncludeMirrorForce, setMustIncludeMirrorForce] = useState(false);
  const [mustIncludeTeamTactics, setMustIncludeTeamTactics] = useState(false);
  const [recommendations, setRecommendations] = useState<
    Record<DeckCount, Recommendation | null>
  >({ 6: null, 9: null });
  const [recommendationErrors, setRecommendationErrors] = useState<
    Record<DeckCount, string>
  >({ 6: "", 9: "" });
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [generatingNine, setGeneratingNine] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [bossError, setBossError] = useState("");
  const completedJobRef = useRef("");
  const recommendationRequestRef = useRef(0);
  const recommendationsInitializedRef = useRef(false);
  const hasNineRecommendationRef = useRef(false);
  const pendingScrollPositionRef = useRef<number | null>(null);

  const loadRecommendations = useCallback(async () => {
    const requestId = ++recommendationRequestRef.current;
    if (!recommendationsInitializedRef.current) {
      setRecommendationsLoading(true);
    }
    try {
      let recommendation: Recommendation;
      try {
        recommendation = await api.recommendation(
          playerId,
          tab,
          mustIncludeMirrorForce,
          mustIncludeTeamTactics,
        );
      } catch (error) {
        if (tab !== 9 || !(error instanceof ApiError) || error.status !== 404) {
          throw error;
        }
        if (recommendationRequestRef.current !== requestId) return;
        if (!hasNineRecommendationRef.current) setGeneratingNine(true);
        await api.generateNineDeckRecommendations(playerId);
        recommendation = await api.recommendation(
          playerId,
          9,
          mustIncludeMirrorForce,
          mustIncludeTeamTactics,
        );
      }
      if (recommendationRequestRef.current !== requestId) return;
      if (tab === 9) hasNineRecommendationRef.current = true;

      pendingScrollPositionRef.current = window.scrollY;
      setRecommendations((current) => ({
        ...current,
        [tab]: recommendation,
      }));
      setRecommendationErrors((current) => ({ ...current, [tab]: "" }));
    } catch (error) {
      if (recommendationRequestRef.current !== requestId) return;

      pendingScrollPositionRef.current = window.scrollY;
      setRecommendations((current) => ({ ...current, [tab]: null }));
      setRecommendationErrors((current) => ({
        ...current,
        [tab]:
          error instanceof ApiError && error.status === 404
            ? ""
            : errorMessage(
                error,
                `Could not load ${tab === 6 ? "six" : "nine"}-deck recommendations.`,
              ),
      }));
    } finally {
      if (recommendationRequestRef.current === requestId) {
        recommendationsInitializedRef.current = true;
        setRecommendationsLoading(false);
        setGeneratingNine(false);
      }
    }
  }, [mustIncludeMirrorForce, mustIncludeTeamTactics, playerId, tab]);

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
      hasNineRecommendationRef.current = false;
      pendingScrollPositionRef.current = null;
      setRecommendationsLoading(true);
    });
    Promise.allSettled([api.player(playerId), api.currentBoss(), api.cards()]).then(
      ([playerResult, bossResult, cardsResult]) => {
        if (!active) return;
        if (playerResult.status === "fulfilled") setPlayer(playerResult.value);
        else setPageError(errorMessage(playerResult.reason, "Could not load this player."));
        if (bossResult.status === "fulfilled") setBoss(bossResult.value);
        else setBossError(errorMessage(bossResult.reason, "No current boss is available."));
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
        hasNineRecommendationRef.current = false;
        setRecommendations((current) => ({ ...current, 9: null }));
        void loadRecommendations();
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
            <div><dt>Current boss</dt><dd>{boss?.boss_data.boss_name ?? "Missing"}</dd></div>
          </dl>
        </header>

        {!player.stats && (
          <div className="notice-box">
            This player has no current stats. Import and save stats in Admin before running a simulation.
          </div>
        )}
        {bossError && <div className="notice-box">{bossError}</div>}
        <section className="panel section-gap">
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
              <div className="tabs" role="tablist" aria-label="Recommendation deck count">
                <button type="button" role="tab" aria-selected={tab === 6} className={tab === 6 ? "active" : ""} onClick={() => setTab(6)}>Best 6 decks</button>
                <button type="button" role="tab" aria-selected={tab === 9} className={tab === 9 ? "active" : ""} onClick={() => setTab(9)}>Best 9 decks</button>
              </div>
            </div>
          </div>
          <RecommendationDecks
            recommendation={recommendations[tab]}
            cards={cards}
            loading={recommendationsLoading || generatingNine}
            error={recommendationErrors[tab]}
            emptyMessage={
              generatingNine
                ? "Generating the best 9-deck recommendations from the latest simulation..."
                : mustIncludeMirrorForce || mustIncludeTeamTactics
                  ? "No recommendation containing the selected required cards is available. Run a new simulation to generate it."
                  : undefined
            }
          />
        </section>
      </main>
    </div>
  );
}
