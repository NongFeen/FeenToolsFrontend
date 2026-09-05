export interface CardDefinitionDto {
  id: string;
  name: string;
  type: string;
  seasonal_level_boost: number;
}

export interface CardEntry {
  card_id: string;
  cardtype: string;
  level: number;
  enabled?: boolean;
}

export interface PlayerData {
  player_raid_level: number;
  player_raid_base_damage: number;
  raid_set: Record<string, boolean>;
  titan_soul_research: Record<string, number>;
  raid_card_research: Record<string, number>;
  gem_stone_research: Record<string, number>;
  card_list: CardEntry[];
  title: number;
}

export function formatLabel(key: string) {
  return key
    .replace(/_(mult|damage)/g, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const TITAN_SOUL_GROUPS = [
  {
    subTitle: "Titan Parts Multipliers",
    keys: ["head_mult", "torso_mult", "limbs_mult", "armor_mult", "body_mult"],
  },
  {
    subTitle: "Titan Boss Targeted Multipliers",
    keys: [
      "lojak_mult",
      "takedar_mult",
      "jukk_mult",
      "sterl_mult",
      "mohaca_mult",
      "terro_mult",
      "klonk_mult",
      "priker_mult",
    ],
  },
];

export const CARD_AND_GEM_GROUPS = [
  { subTitle: "Base Damage", keys: ["base_damage"] },
  {
    subTitle: "Part Damage",
    keys: ["head_damage", "torso_damage", "limbs_damage"],
  },
  {
    subTitle: "Part Armor Type",
    keys: [
      "armor_damage",
      "head_armor_damage",
      "torso_armor_damage",
      "limbs_armor_damage",
    ],
  },
  {
    subTitle: "Part Body Type",
    keys: [
      "body_damage",
      "head_body_damage",
      "torso_body_damage",
      "limbs_body_damage",
    ],
  },
  {
    subTitle: "Titan Boss Type Additives",
    keys: [
      "lojak_damage",
      "takedar_damage",
      "jukk_damage",
      "sterl_damage",
      "mohaca_damage",
      "terro_damage",
      "klonk_damage",
      "priker_damage",
    ],
  },
  {
    subTitle: "Boss Burst Additives",
    keys: [
      "base_burst_damage",
      "burst_lojak_damage",
      "burst_takedar_damage",
      "burst_jukk_damage",
      "burst_sterl_damage",
      "burst_mohaca_damage",
      "burst_terro_damage",
      "burst_klonk_damage",
      "burst_priker_damage",
    ],
  },
  {
    subTitle: "Boss Affliction Additives",
    keys: [
      "base_affliction_damage",
      "affliction_lojak_damage",
      "affliction_takedar_damage",
      "affliction_jukk_damage",
      "affliction_sterl_damage",
      "affliction_mohaca_damage",
      "affliction_terro_damage",
      "affliction_klonk_damage",
      "affliction_priker_damage",
    ],
  },
];
