import type {
  BossData,
  BossPartName,
  BossUpdateAccepted,
  CardDefinition,
  ConvertedPlayerDataResponse,
  CurrentBoss,
  HealthResponse,
  JobAccepted,
  PlayerDetail,
  PlayerRaidData,
  PlayerStatsVersion,
  PlayerSummary,
  Recommendation,
  SimulationJob,
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
  createPlayer: (body: {
    player_id: string;
    display_name: string;
    auto_sims: boolean;
  }) => request<PlayerSummary>("/api/players", { method: "POST", body: json(body) }),
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
  playerJobs: (playerId: string) =>
    request<SimulationJob[]>(`${playerPath(playerId)}/simulation-jobs`),
  currentBoss: () => request<CurrentBoss>("/api/current-boss"),
  recommendation: (
    playerId: string,
    deckCount: 6 | 9,
    mustIncludeMirrorForce = false,
    mustIncludeTeamTactics = false,
  ) =>
    request<Recommendation>(
      `${playerPath(playerId)}/recommendations/current?deck_count=${deckCount}&must_include_mirror_force=${mustIncludeMirrorForce}&must_include_team_tactics=${mustIncludeTeamTactics}`,
    ),
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
  createSimulation: (player_id: string) =>
    request<JobAccepted>(
      "/internal/simulation-jobs",
      { method: "POST", body: json({ player_id }) },
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
};

export const assetUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};
