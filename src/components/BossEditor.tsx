import type {
  BossData,
  BossName,
  BossPart,
  BossPartName,
  CurrentBoss,
  GlobalRaidModifier,
  PartState,
} from "../api/types";
import ShorthandNumberInput from "./ShorthandNumberInput";

type BossPartKey = Exclude<keyof BossData, "boss_name" | "global_raid_modifier" | "damage_results">;

const PARTS: Array<{ key: BossPartKey; name: BossPartName; label: string }> = [
  { key: "head", name: "Head", label: "Head" },
  { key: "torso", name: "Torso", label: "Torso" },
  { key: "left_shoulder", name: "LeftShoulder", label: "Left shoulder" },
  { key: "right_shoulder", name: "RightShoulder", label: "Right shoulder" },
  { key: "left_hand", name: "LeftHand", label: "Left hand" },
  { key: "right_hand", name: "RightHand", label: "Right hand" },
  { key: "left_leg", name: "LeftLeg", label: "Left leg" },
  { key: "right_leg", name: "RightLeg", label: "Right leg" },
];

const GLOBAL_RAID_MODIFIERS: Array<{ value: GlobalRaidModifier; label: string }> = [
  { value: "None", label: "None" },
  { value: "BurstDamage", label: "Burst damage ×1.30" },
  { value: "BurstChance", label: "Burst chance ×1.30" },
  { value: "SupportEffect", label: "Support effect ×1.15" },
  { value: "AfflictionChance", label: "Affliction chance ×1.30" },
  { value: "AfflictionDamage", label: "Affliction damage ×1.30" },
  { value: "AllDamage", label: "All damage ×1.15" },
  { value: "AttackDuration", label: "Attack duration +3 seconds" },
  { value: "AfflictionDuration", label: "Affliction duration ×1.50" },
];

const LEG_PARTS: BossPartKey[] = ["left_leg", "right_leg"];
const ARM_PARTS: BossPartKey[] = ["left_shoulder", "right_shoulder", "left_hand", "right_hand"];

interface Props {
  value: CurrentBoss;
  onChange: (value: CurrentBoss) => void;
  onSave: () => void;
  saving: boolean;
}

export default function BossEditor({ value, onChange, onSave, saving }: Props) {
  const updatePart = (key: BossPartKey, changes: Partial<BossPart>) => {
    const current = value.boss_data[key];
    if (!current || typeof current !== "object" || !("part_name" in current)) return;
    onChange({ ...value, boss_data: { ...value.boss_data, [key]: { ...current, ...changes } } });
  };
  const toggleAttackable = (partName: BossPartName, checked: boolean) => {
    const attackable_parts = checked
      ? [...new Set([...value.attackable_parts, partName])]
      : value.attackable_parts.filter((part) => part !== partName);
    onChange({ ...value, attackable_parts });
  };
  const groupTotal = (keys: BossPartKey[], field: "max_armor" | "max_health") =>
    keys.reduce((total, key) => total + (value.boss_data[key] as BossPart)[field], 0);
  const distributeGroupTotal = (
    keys: BossPartKey[],
    field: "max_armor" | "max_health",
    total: number,
  ) => {
    const perPart = total / keys.length;
    const boss_data = { ...value.boss_data };
    keys.forEach((key) => {
      const part = boss_data[key] as BossPart;
      boss_data[key] = { ...part, [field]: perPart };
    });
    onChange({ ...value, boss_data });
  };
  const resetCurrentToMax = () => {
    const boss_data = { ...value.boss_data };
    PARTS.forEach(({ key }) => {
      const part = boss_data[key];
      boss_data[key] = {
        ...part,
        current_armor: part.max_armor,
        current_health: part.max_health,
      };
    });
    onChange({ ...value, boss_data });
  };

  return (
    <section id="section-boss" className="panel scroll-target">
      <div className="panel-heading-row">
        <div><h2 className="panel-title">Current Boss</h2><p className="panel-desc">Edit the singleton boss. Saving clears old jobs and does not start simulations.</p></div>
        <button className="calc-btn" type="button" disabled={saving || value.attackable_parts.length === 0} onClick={onSave}>{saving ? "Saving…" : "Save boss"}</button>
      </div>
      <div className="boss-options-grid">
        <label className="field">
          <span>Titan name</span>
          <select value={value.boss_data.boss_name} onChange={(event) => onChange({ ...value, boss_data: { ...value.boss_data, boss_name: event.target.value as BossName } })}>
            {(["Lojak", "Takedar", "Jukk", "Sterl", "Mohaca", "Terro", "Klonk", "Priker"] as BossName[]).map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Global raid modifier</span>
          <select value={value.boss_data.global_raid_modifier ?? "None"} onChange={(event) => onChange({ ...value, boss_data: { ...value.boss_data, global_raid_modifier: event.target.value as GlobalRaidModifier } })}>
            {GLOBAL_RAID_MODIFIERS.map((modifier) => <option key={modifier.value} value={modifier.value}>{modifier.label}</option>)}
          </select>
          <small>Only one modifier can be active for the current boss.</small>
        </label>
      </div>
      <fieldset className="boss-group-helper">
        <legend>Max armor/body group helpers</legend>
        <div className="boss-group-helper-heading">
          <p>Enter a group total to split it evenly across its individual parts. You can still edit every part below.</p>
          <button className="secondary-btn" type="button" onClick={resetCurrentToMax}>Reset current to max</button>
        </div>
        <div className="boss-group-helper-grid">
          <label className="field">
            <span>Arms/shoulders max armor total <small>(divided by 4)</small></span>
            <ShorthandNumberInput ariaLabel="Arms and shoulders max armor total" min={0} integer value={groupTotal(ARM_PARTS, "max_armor")} onValueChange={(total) => distributeGroupTotal(ARM_PARTS, "max_armor", total)} />
          </label>
          <label className="field">
            <span>Arms/shoulders max body total <small>(divided by 4)</small></span>
            <ShorthandNumberInput ariaLabel="Arms and shoulders max body total" min={0} integer value={groupTotal(ARM_PARTS, "max_health")} onValueChange={(total) => distributeGroupTotal(ARM_PARTS, "max_health", total)} />
          </label>
          <label className="field">
            <span>Legs max armor total <small>(divided by 2)</small></span>
            <ShorthandNumberInput ariaLabel="Legs max armor total" min={0} integer value={groupTotal(LEG_PARTS, "max_armor")} onValueChange={(total) => distributeGroupTotal(LEG_PARTS, "max_armor", total)} />
          </label>
          <label className="field">
            <span>Legs max body total <small>(divided by 2)</small></span>
            <ShorthandNumberInput ariaLabel="Legs max body total" min={0} integer value={groupTotal(LEG_PARTS, "max_health")} onValueChange={(total) => distributeGroupTotal(LEG_PARTS, "max_health", total)} />
          </label>
        </div>
      </fieldset>
      <div className="boss-table-wrap">
        <table className="boss-table">
          <thead><tr><th>Part</th><th>State</th><th>Target</th><th>Max armor</th><th>Current armor</th><th>Max health</th><th>Current health</th></tr></thead>
          <tbody>
            {PARTS.map(({ key, name, label }) => {
              const part = value.boss_data[key] as BossPart;
              return (
                <tr key={name}>
                  <th scope="row">{label}</th>
                  <td><select aria-label={`${label} state`} value={part.part_state} onChange={(event) => updatePart(key, { part_state: event.target.value as PartState })}>{(["Armor", "Body", "Cursed", "Skeleton"] as PartState[]).map((state) => <option key={state}>{state}</option>)}</select></td>
                  <td><input aria-label={`Target ${label}`} type="checkbox" checked={value.attackable_parts.includes(name)} onChange={(event) => toggleAttackable(name, event.target.checked)} /></td>
                  {(["max_armor", "current_armor", "max_health", "current_health"] as const).map((field) => <td key={field}><ShorthandNumberInput ariaLabel={`${label} ${field.replace("_", " ")}`} min={0} integer value={part[field]} onValueChange={(nextValue) => updatePart(key, { [field]: nextValue })} /></td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="number-input-hint">Large values accept shorthand such as 22.52B, 1.5M, 2e6, or 1,000.</p>
      {value.attackable_parts.length === 0 && <div className="error-box">Select at least one attackable part.</div>}
    </section>
  );
}
