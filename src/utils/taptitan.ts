import type { BossPart, BossPartName, CurrentBoss, SimulationJob } from "../api/types";

const ACTIVE_JOB_STATUSES = new Set(["pending", "running", "optimizing"]);

export const isActiveJob = (job: SimulationJob | null | undefined) =>
  Boolean(job && ACTIVE_JOB_STATUSES.has(job.status));

export const makeDefaultBoss = (): CurrentBoss => {
  const part = (part_name: BossPartName): BossPart => ({
    part_name,
    part_state: "Armor",
    max_armor: 1_000_000,
    max_health: 1_000_000,
    current_armor: 1_000_000,
    current_health: 1_000_000,
    radioactivity_afflicted_seconds: 0,
  });
  return {
    boss_data: {
      boss_name: "Lojak",
      global_raid_modifier: "None",
      head: part("Head"),
      torso: part("Torso"),
      left_shoulder: part("LeftShoulder"),
      right_shoulder: part("RightShoulder"),
      left_hand: part("LeftHand"),
      right_hand: part("RightHand"),
      left_leg: part("LeftLeg"),
      right_leg: part("RightLeg"),
      damage_results: [],
    },
    attackable_parts: ["Head", "Torso", "LeftShoulder", "RightShoulder", "LeftHand", "RightHand", "LeftLeg", "RightLeg"],
    created_at: "",
    updated_at: "",
  };
};
