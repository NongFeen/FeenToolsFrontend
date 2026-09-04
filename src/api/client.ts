import type {
  BossData,
  BossPartName,
  BossUpdateAccepted,
  CardDefinition,
  ConvertedPlayerDataResponse,
  CurrentBoss,
  DebugSimulationResponse,
  HealthResponse,
  JobAccepted,
  LiveAttackingPlayer,
  LiveCurrentBoss,
  PlayerAttackLogEntry,
  PlayerDetail,
  PlayerRaidData,
  PlayerStatsVersion,
  PlayerSummary,
  Recommendation,
  RecommendationGenerationResponse,
  RaidCycle,
  SimulationBatch,
  SimulationBatchAccepted,
  SimulationJob,
  Tt2PlayerStatus,
  Tt2ClanStatus,
  Tt2ClanFetchResult,
} from "./types";

const baseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const internalKey = String(import.meta.env.VITE_INTERNAL_API_KEY ?? "");

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  protectedRequest = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (protectedRequest) {
    if (!internalKey) {
      throw new ApiError(
        "VITE_INTERNAL_API_KEY is not configured for this local admin build.",
        0,
      );
    }
    headers.set("x-internal-api-key", internalKey);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Could not connect to the backend.", 0);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const nested = body?.error ?? body?.data?.error;
    throw new ApiError(
      nested?.message ?? body?.message ?? `Request failed (${response.status})`,
      response.status,
      nested?.code ?? body?.code,
    );
  }
  return body as T;
}

const json = (value: unknown) => JSON.stringify(value);
const playerPath = (playerId: string) =>
  `/api/players/${encodeURIComponent(playerId)}`;

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  players: () => request<PlayerSummary[]>("/api/players"),
  player: (playerId: string) => request<PlayerDetail>(playerPath(playerId)),
  currentStats: (playerId: string) =>
    request<PlayerStatsVersion>(`${playerPath(playerId)}/stats/current`),
  updateStats: (playerId: string, body: PlayerRaidData | unknown) =>
    request<PlayerStatsVersion>(`${playerPath(playerId)}/stats`, {
      method: "PUT",
      body: json(body),
    }),
  updateAutoSims: (playerId: string, auto_sims: boolean) =>
    request<PlayerSummary>(`${playerPath(playerId)}/auto_sims`, {
      method: "PUT",
      body: json({ auto_sims }),
    }),
  updatePlayerToken: (playerId: string, player_token: string) =>
    request<PlayerSummary>(
      `/internal/players/${encodeURIComponent(playerId)}/token`,
      { method: "PUT", body: json({ player_token }) },
      true,
    ),
  clearPlayerToken: (playerId: string) =>
    request<PlayerSummary>(
      `/internal/players/${encodeURIComponent(playerId)}/token`,
      { method: "DELETE" },
      true,
    ),
  fetchPlayerStats: (playerId: string) =>
    request<PlayerStatsVersion>(
      `/internal/players/${encodeURIComponent(playerId)}/fetch-stats`,
      { method: "POST" },
      true,
    ),
  tt2PlayerStatus: () =>
    request<Tt2PlayerStatus>("/internal/tt2/player-status", {}, true),
  tt2ClanStatus: () =>
    request<Tt2ClanStatus>("/internal/tt2/clan-status", {}, true),
  fetchClanStats: () =>
    request<Tt2ClanFetchResult>(
      "/internal/tt2/fetch-clan-stats",
      { method: "POST" },
      true,
    ),
  playerJobs: (playerId: string) =>
    request<SimulationJob[]>(`${playerPath(playerId)}/simulation-jobs`),
  playerAttackLog: (playerId: string) =>
    request<PlayerAttackLogEntry[]>(`${playerPath(playerId)}/attack-log`),
  currentBoss: () => request<CurrentBoss>("/api/current-boss"),
  simsBoss: () => request<CurrentBoss>("/api/current-boss"),
  liveCurrentBoss: () => request<LiveCurrentBoss>("/api/live-current-boss"),
  liveCurrentBossStreamUrl: () => `${baseUrl}/api/live-current-boss/stream`,
  liveAttackingPlayers: () =>
    request<LiveAttackingPlayer[]>("/api/live-attacking-players"),
  liveAttackingPlayersStreamUrl: () => `${baseUrl}/api/live-attacking-players/stream`,
  currentRaidCycle: () => request<RaidCycle>("/api/raid-cycle/current"),
  recommendation: (
    playerId: string,
    deckCount: number,
    mustIncludeMirrorForce = false,
    mustIncludeTeamTactics = false,
    includeBodyPhase?: boolean,
  ) =>
    request<Recommendation>(
      `${playerPath(playerId)}/recommendations/current?deck_count=${deckCount}&must_include_mirror_force=${mustIncludeMirrorForce}&must_include_team_tactics=${mustIncludeTeamTactics}${includeBodyPhase === undefined ? "" : `&include_body_phase=${includeBodyPhase}`}`,
    ),
  generateRecommendations: (playerId: string, deckCount: number, include_body_phase = false) =>
    request<RecommendationGenerationResponse>(
      `${playerPath(playerId)}/recommendations`,
      { method: "POST", body: json({ deck_count: deckCount, include_body_phase }) },
    ),
  customRecommendation: (
    playerId: string,
    deckCount: number,
    excludedCards: string[],
    mustIncludeMirrorForce = false,
    mustIncludeTeamTactics = false,
    includeBodyPhase = false,
  ) =>
    request<Recommendation>(`${playerPath(playerId)}/recommendations/custom`, {
      method: "POST",
      body: json({
        deck_count: deckCount,
        include_body_phase: includeBodyPhase,
        excluded_cards: excludedCards,
        must_include_mirror_force: mustIncludeMirrorForce,
        must_include_team_tactics: mustIncludeTeamTactics,
      }),
    }),
  cards: () => request<CardDefinition[]>("/api/taptitan/cards"),
  convertPlayerData: (body: unknown) =>
    request<ConvertedPlayerDataResponse>("/api/taptitan/player_data", {
      method: "POST",
      body: json(body),
    }),
  updateBoss: (boss_data: BossData, attackable_parts: BossPartName[]) =>
    request<BossUpdateAccepted>(
      "/internal/current-boss",
      {
        method: "PUT",
        body: json({ boss_data, attackable_parts, run_sims: false }),
      },
      true,
    ),
  createSimulation: (player_id: string, include_body_phase = false) =>
    request<JobAccepted>(
      "/internal/simulation-jobs",
      { method: "POST", body: json({ player_id, include_body_phase }) },
      true,
    ),
  createSimulationBatch: (player_ids: string[], include_body_phase = false) =>
    request<SimulationBatchAccepted>(
      "/internal/simulation-jobs/batch",
      { method: "POST", body: json({ player_ids, include_body_phase }) },
      true,
    ),
  simulationBatch: (batchId: string) =>
    request<SimulationBatch>(
      `/internal/simulation-jobs/batch/${encodeURIComponent(batchId)}`,
      {},
      true,
    ),
  internalJob: (jobId: string) =>
    request<SimulationJob>(
      `/internal/simulation-jobs/${encodeURIComponent(jobId)}`,
      {},
      true,
    ),
  retryJob: (jobId: string) =>
    request<JobAccepted>(
      `/internal/simulation-jobs/${encodeURIComponent(jobId)}/retry`,
      { method: "POST" },
      true,
    ),
  runDebugSimulation: (body: {
    player_id: string;
    boss_data: BossData;
    attackable_parts: BossPartName[];
    deck: string[];
    total_taps: number;
    rounds_per_pattern: number;
  }) =>
    request<DebugSimulationResponse>(
      "/internal/simulation-debug",
      { method: "POST", body: json(body) },
      true,
    ),
};

export const assetUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/assets/")) return path;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};
