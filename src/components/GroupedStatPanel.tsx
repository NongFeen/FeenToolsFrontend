import { useState } from "react";
import { formatLabel } from "../dto/CardDefinitionDto";

interface Props {
  id: string;
  title: string;
  description: string;
  stats: Record<string, number>;
  structureGroups: Array<{ subTitle: string; keys: string[] }>;
  isPercentage?: boolean;
  onChange: (key: string, value: number) => void;
}

export default function GroupedStatSectionPanel({ id, title, description, stats, structureGroups, isPercentage = false, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <section id={id} className="panel scroll-target">
      <button className="panel-header-interactive" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
        <span><span className="panel-title">{title}</span><span className="panel-desc">{description}</span></span>
        <span className={`disclosure ${isOpen ? "open" : ""}`} aria-hidden="true">▾</span>
      </button>
      {isOpen && <div className="stat-sections">{structureGroups.map((group) => {
        const activeKeys = group.keys.filter((key) => key in stats);
        if (!activeKeys.length) return null;
        return <div className="stat-section" key={group.subTitle}><h4>{group.subTitle}</h4><div className="stat-grid-layout">{activeKeys.map((key) => {
          const displayValue = isPercentage ? Math.round((stats[key] ?? 0) * 100) : (stats[key] ?? 0);
          return <label key={key} className="result-card stat-row-card"><span className="result-label">{formatLabel(key)}</span><span className="inline-input-wrap"><input type="number" className="stat-inline-input" value={displayValue} onChange={(event) => { const value = Number.parseFloat(event.target.value) || 0; onChange(key, isPercentage ? value / 100 : value); }} />{isPercentage && <span>%</span>}</span></label>;
        })}</div></div>;
      })}</div>}
    </section>
  );
}
