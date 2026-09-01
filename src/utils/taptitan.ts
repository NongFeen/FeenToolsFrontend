import type { BossPart, BossPartName, CurrentBoss, CurseType, GlobalRaidModifier, LiveCurrentBoss, SimulationJob } from "../api/types";

const ACTIVE_JOB_STATUSES = new Set(["pending", "running", "optimizing"]);

export const GLOBAL_RAID_MODIFIER_LABELS: Record<GlobalRaidModifier, string> = {
  None: "None",
  BurstDamage: "Burst damage ×1.30",
  BurstChance: "Burst chance ×1.30",
  SupportEffect: "Support effect ×1.15",
  AfflictionChance: "Affliction chance ×1.30",
  AfflictionDamage: "Affliction damage ×1.30",
  AllDamage: "All damage ×1.15",
  AttackDuration: "Attack duration +3 seconds",
  AfflictionDuration: "Affliction duration ×1.50",
};

export const CURSE_TYPE_LABELS: Record<CurseType, string> = {
  None: "None",
  BodyDamage: "Body damage",
  BurstDamage: "Burst damage",
  AfflictionDamage: "Affliction damage",
};

export const isActiveJob = (job: SimulationJob | null | undefined) =>
  Boolean(job && ACTIVE_JOB_STATUSES.has(job.status));

export const enforcePartStateValues = (part: BossPart): BossPart => {
  switch (part.part_state) {
    case "Armor":
    case "Cursed":
      return { ...part, current_health: part.max_health };
    case "Body":
      return { ...part, current_armor: 0 };
    case "Skeleton":
      return { ...part, current_armor: 0, current_health: 0 };
  }
};

const PART_KEYS: Record<BossPartName, keyof Pick<
  CurrentBoss["boss_data"],
  "head" | "torso" | "left_shoulder" | "right_shoulder" | "left_hand" | "right_hand" | "left_leg" | "right_leg"
>> = {
  Head: "head",
  Torso: "torso",
  LeftShoulder: "left_shoulder",
  RightShoulder: "right_shoulder",
  LeftHand: "left_hand",
  RightHand: "right_hand",
  LeftLeg: "left_leg",
  RightLeg: "right_leg",
};

/**
 * Merges the already-loaded live "Current Boss" panel data into the Sims
 * Boss editor, entirely client-side (no request). The live feed only ever
 * reports one HP pair per part (whichever phase is currently active), so a
 * part that has already broken through armor keeps its existing max_armor
 * here rather than losing it -- TT2 stops reporting a destroyed layer's max.
 * boss_name/curse_type/global raid modifier aren't in the live feed either
 * and are left untouched.
 */
export const syncBossFromLiveBoss = (current: CurrentBoss, live: LiveCurrentBoss): CurrentBoss => {
  const displayParts = live.display_parts;
  if (!displayParts || displayParts.length === 0) return current;

  const boss_data = { ...current.boss_data };
  const targeted: BossPartName[] = [];
  for (const displayPart of displayParts) {
    const key = PART_KEYS[displayPart.part_name];
    const changes: Partial<BossPart> =
      displayPart.part_state === "Armor" || displayPart.part_state === "Cursed"
        ? { part_state: displayPart.part_state, current_armor: displayPart.current_hp, max_armor: displayPart.max_hp }
        : displayPart.part_state === "Body"
          ? { part_state: "Body", current_health: displayPart.current_hp, max_health: displayPart.max_hp }
          : { part_state: "Skeleton" };
    boss_data[key] = enforcePartStateValues({ ...boss_data[key], ...changes });
    if (displayPart.is_targeted) targeted.push(displayPart.part_name);
  }

  return { ...current, boss_data, attackable_parts: targeted };
};

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
      global_raid_modifier_amount: null,
      curse_type: "None",
      curse_damage_per_curse: 0.06,
      recommend_1_to_2_part_patterns_only: false,
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
