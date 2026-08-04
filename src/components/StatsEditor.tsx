import BaseStatBar from "./BaseStatBar";
import CardGrid from "./CardGrid";
import GroupedStatSectionPanel from "./GroupedStatPanel";
import {
  CARD_AND_GEM_GROUPS,
  TITAN_SOUL_GROUPS,
  formatLabel,
  type PlayerData,
} from "../dto/CardDefinitionDto";
import type { CardDefinition } from "../api/types";

interface StatsEditorProps {
  data: PlayerData;
  cardDefinitions: CardDefinition[];
  onChange: (data: PlayerData) => void;
}

export default function StatsEditor({ data, cardDefinitions, onChange }: StatsEditorProps) {
  return (
    <div className="editor-stack">
      <section id="section-multipliers" className="panel scroll-target">
        <h2 className="panel-title">Account Base Multipliers</h2>
        <p className="panel-desc">Edit the player raid level and base damage.</p>
        <BaseStatBar data={data} onStatChange={(key, value) => onChange({ ...data, [key]: value })} />
        <div className="field-grid compact-fields">
          <label className="field">
            <span>Title bonus</span>
            <input type="number" step="0.01" value={data.title} onChange={(event) => onChange({ ...data, title: Number(event.target.value) || 0 })} />
          </label>
          <fieldset className="raid-set-fieldset">
            <legend>Raid sets</legend>
            <div className="check-grid">
              {Object.entries(data.raid_set).map(([key, value]) => (
                <label key={key} className="check-row">
                  <input type="checkbox" checked={value} onChange={(event) => onChange({ ...data, raid_set: { ...data.raid_set, [key]: event.target.checked } })} />
                  <span>{formatLabel(key)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </section>
      <GroupedStatSectionPanel id="section-titan-soul" title="Titan Soul Research" description="Anatomical location and Titan Lord target multipliers (percentages)." stats={data.titan_soul_research} structureGroups={TITAN_SOUL_GROUPS} isPercentage onChange={(key, value) => onChange({ ...data, titan_soul_research: { ...data.titan_soul_research, [key]: value } })} />
      <GroupedStatSectionPanel id="section-raid-card" title="Raid Card Research Bonus" description="Card capability milestones grouped by scaling category." stats={data.raid_card_research} structureGroups={CARD_AND_GEM_GROUPS} onChange={(key, value) => onChange({ ...data, raid_card_research: { ...data.raid_card_research, [key]: value } })} />
      <GroupedStatSectionPanel id="section-gem-stone" title="Gem Stone Research Bonus" description="Talent stone progression attributes grouped by scaling category." stats={data.gem_stone_research} structureGroups={CARD_AND_GEM_GROUPS} onChange={(key, value) => onChange({ ...data, gem_stone_research: { ...data.gem_stone_research, [key]: value } })} />
      <section id="section-card-vault" className="panel scroll-target">
        <h2 className="panel-title">Card Vault Deck</h2>
        <p className="panel-desc">Edit the current level of every imported card.</p>
        <CardGrid cards={data.card_list} cardDefinitions={cardDefinitions} onCardLevelChange={(cardId, level) => onChange({ ...data, card_list: data.card_list.map((card) => card.card_id === cardId ? { ...card, level } : card) })} />
      </section>
    </div>
  );
}
