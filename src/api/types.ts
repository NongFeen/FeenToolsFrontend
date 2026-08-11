export type JobStatus =
  | "pending"
  | "running"
  | "optimizing"
  | "completed"
  | "failed";

export interface ApiErrorBody {
  code?: string;
  message?: string;
  error?: { code?: string; message?: string };
}

export interface PlayerSummary {
  player_id: string;
  display_name: string;
  auto_sims: boolean;
  stats_revision: number | null;
  has_player_token: boolean;
  player_token_status: "missing" | "configured" | "invalid";
  tt2_last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerDetail extends PlayerSummary {
  stats: PlayerRaidData | null;
}

export interface CardDefinition {
  id: string;
  name: string;
  type: string;
  image: string;
}

export interface PlayerCard {
  card_id: string;
  cardtype: string;
  level: number;
  enabled?: boolean;
}

export interface PlayerRaidData {
  player_raid_level: number;
  player_raid_base_damage: number;
  raid_set: Record<string, boolean>;
  titan_soul_research: Record<string, number>;
  raid_card_research: Record<string, number>;
  gem_stone_research: Record<string, number>;
  card_list: PlayerCard[];
  title: number;
}

export interface PlayerStatsVersion {
  revision: number;
  stats: PlayerRaidData;
  created_at: string;
  updated_at: string;
}

export interface Tt2PlayerStatus {
  configured: boolean;
  connected: boolean;
  raid_connected: boolean;
}

export interface Tt2ClanStatus {
  clan_code: string | null;
  clan_name: string | null;
  last_fetched_at: string | null;
  next_fetch_at: string | null;
  last_player_count: number;
}

export interface Tt2ClanFetchResult {
  clan_code: string;
  clan_name: string;
  created_players: number;
  updated_players: number;
  player_count: number;
  last_fetched_at: string;
  next_fetch_at: string;
}

export interface SimulationJob {
  id: string;
  player_id: string;
  simulator_version: string;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export type BossName =
  | "Lojak"
  | "Takedar"
  | "Jukk"
  | "Sterl"
  | "Mohaca"
  | "Terro"
  | "Klonk"
  | "Priker";

export type BossPartName =
  | "Head"
  | "Torso"
  | "LeftShoulder"
  | "RightShoulder"
  | "LeftHand"
  | "RightHand"
  | "LeftLeg"
  | "RightLeg";

export type PartState = "Cursed" | "Armor" | "Body" | "Skeleton";
export type CurseType = "None" | "BodyDamage" | "BurstDamage" | "AfflictionDamage";

export type GlobalRaidModifier =
  | "None"
  | "BurstDamage"
  | "BurstChance"
  | "SupportEffect"
  | "AfflictionChance"
  | "AfflictionDamage"
  | "AllDamage"
  | "AttackDuration"
  | "AfflictionDuration";

export interface BossPart {
  part_name: BossPartName;
  part_state: PartState;
  max_armor: number;
  max_health: number;
  current_armor: number;
  current_health: number;
  radioactivity_afflicted_seconds: number;
}

export interface BossData {
  boss_name: BossName;
  global_raid_modifier: GlobalRaidModifier;
  curse_type: CurseType;
  recommend_1_to_2_part_patterns_only: boolean;
  head: BossPart;
  torso: BossPart;
  left_shoulder: BossPart;
  right_shoulder: BossPart;
  left_hand: BossPart;
  right_hand: BossPart;
  left_leg: BossPart;
  right_leg: BossPart;
  damage_results: unknown[];
}

export interface CurrentBoss {
  boss_data: BossData;
  attackable_parts: BossPartName[];
  created_at: string;
  updated_at: string;
}

export interface SimPatternResult {
  pattern: string;
  average_damage: number;
  average_damage_display: string;
  lowest_round_damage: number;
  lowest_round_damage_display: string;
  highest_round_damage: number;
  highest_round_damage_display: string;
  card_damage?: SimCardDamageResult[];
}

export interface SimCardDamageResult {
  card: string;
  card_name: string;
  average_damage: number;
  average_damage_display: string;
}

export interface SimDeckResult {
  deck: string[];
  deck_names?: string[];
  total_attack_patterns?: number;
  best_pattern: SimPatternResult | null;
  simulation_phase?: "current" | "targeted_body";
  patterns?: SimPatternResult[];
}

export interface DebugSimulationResponse {
  rounds_per_pattern: number;
  ticks_per_round: number;
  total_taps: number;
  result: SimDeckResult;
}

export interface RecommendedDeck {
  position: number;
  cards: string[];
  average_damage: string;
  result: SimDeckResult;
}

export interface Recommendation {
  id: string;
  simulation_job_id: string;
  deck_count: number;
  must_include_mirror_force: boolean;
  must_include_team_tactics: boolean;
  total_average_damage: string;
  body_phase_ran: boolean;
  decks: RecommendedDeck[];
  created_at: string;
}

export interface RecommendationGenerationResponse {
  deck_count: number;
  created: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  database: boolean;
}

export interface JobAccepted {
  job_id: string;
  created: boolean;
}

export interface SimulationBatchAccepted {
  batch_id: string;
  requested: number;
  queued: number;
  existing: number;
}

export interface SimulationBatch {
  batch_id: string;
  status: "running" | "completed" | "completed_with_failures";
  requested: number;
  tracked: number;
  queued: number;
  pending: number;
  running: number;
  optimizing: number;
  completed: number;
  failed: number;
  simulation_time_ms: number;
  recommendation_time_ms: number;
  combined_processing_time_ms: number;
  wall_time_ms: number;
  created_at: string;
  completed_at: string | null;
}

export interface BossUpdateAccepted {
  status: string;
  message: string;
  simulations_triggered: boolean;
  deleted_jobs: number;
  created_jobs: string[];
}

export interface ConvertedPlayerDataResponse {
  success: "true" | true;
  data: { data: PlayerRaidData };
}
