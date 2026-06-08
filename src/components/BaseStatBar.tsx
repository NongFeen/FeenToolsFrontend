import { type PlayerData, formatLabel } from "../dto/CardDefinitionDto";

interface BaseStatBarProps {
  data: PlayerData;
  onStatChange: (
    key: "player_raid_level" | "player_raid_base_damage",
    value: number,
  ) => void;
}

export default function BaseStatBar({ data, onStatChange }: BaseStatBarProps) {
  const activeSets = Object.entries(data.raid_set)
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div className="results" style={{ marginBottom: "1rem" }}>
        <div className="result-card">
          <span className="result-label">Raid Level</span>
          <input
            type="number"
            className="stat-inline-input-large"
            value={data.player_raid_level}
            onChange={(e) =>
              onStatChange(
                "player_raid_level",
                Math.max(0, parseInt(e.target.value) || 0),
              )
            }
          />
        </div>
        <div className="result-card">
          <span className="result-label">Base Damage</span>
          <input
            type="number"
            className="stat-inline-input-large"
            value={data.player_raid_base_damage}
            onChange={(e) =>
              onStatChange(
                "player_raid_base_damage",
                Math.max(0, parseInt(e.target.value) || 0),
              )
            }
          />
        </div>
        <div className="result-card">
          <span className="result-label">Cards Tracked</span>
          <span className="result-value">{data.card_list.length}</span>
        </div>
      </div>

      {activeSets.length > 0 && (
        <div>
          <p className="result-label" style={{ marginBottom: "0.5rem" }}>
            Active Raid Sets
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {activeSets.map((s) => (
              <span
                key={s}
                style={{
                  padding: "0.25rem 0.65rem",
                  background: "var(--accent-light)",
                  border: "1px solid #ead8cf",
                  borderRadius: "999px",
                  fontSize: "0.75rem",
                  color: "var(--accent)",
                  fontWeight: 500,
                }}
              >
                {formatLabel(s)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
