import type {
  CardDefinition,
  ConvertedPlayerDataResponse,
  CurrentBoss,
  HealthResponse,
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
  SimulationJob,
} from "./types";

const baseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

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
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");

  const url = `${baseUrl}${path}`;
  // Left in for production too: when VITE_API_BASE_URL is misconfigured,
  // this is the fastest way to see where a request actually went.
  console.log(`[api] ${options.method ?? "GET"} ${url}`);

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(`Could not connect to ${url}.`, 0);
  }

  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const nested = body?.error ?? body?.data?.error;
    throw new ApiError(
      nested?.message ?? body?.message ?? `Request failed (${response.status}) for ${url}`,
      response.status,
      nested?.code ?? body?.code,
    );
  }
  if (!isJson) {
    throw new ApiError(
      `Backend returned a non-JSON response for ${url}. Check VITE_API_BASE_URL.`,
      response.status,
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
};

export const assetUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/assets/")) return path;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

// The backend used to send this path back on every card (redundant --
// derivable from the card id alone), but the frontend owns these files
// (public/assets/taptitan/cards/), so it owns the naming convention too.
export const cardImagePath = (cardId: string) => `/assets/taptitan/cards/${cardId}.webp`;
