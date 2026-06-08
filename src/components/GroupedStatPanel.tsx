import { useState } from "react";
import { formatLabel } from "../dto/CardDefinitionDto";

interface GroupedSectionProps {
  id: string;
  title: string;
  description: string;
  stats: Record<string, number>;
  structureGroups: Array<{ subTitle: string; keys: string[] }>;
  isPercentage?: boolean;
  onChange: (key: string, value: number) => void;
}

export default function GroupedStatSectionPanel({
  id,
  title,
  description,
  stats,
  structureGroups,
  isPercentage = false,
  onChange,
}: GroupedSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      id={id}
      className="panel scroll-target"
      style={{ marginTop: "1.5rem" }}
    >
      <div
        className="panel-header-interactive"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div>
          <h3 className="panel-title" style={{ margin: 0 }}>
            {title}
          </h3>
          <p className="panel-desc" style={{ margin: "0.2rem 0 0 0" }}>
            {description}
          </p>
        </div>
        <span
          style={{
            fontSize: "1.2rem",
            transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </div>

      {isOpen && (
        <div style={{ marginTop: "1rem" }}>
          {structureGroups.map((group) => {
            const activeKeys = group.keys.filter((k) => k in stats);
            if (activeKeys.length === 0) return null;

            return (
              <div
                key={group.subTitle}
                style={{
                  marginTop: "1.25rem",
                  borderTop: "1px dashed var(--border)",
                  paddingTop: "1rem",
                }}
              >
                <h4
                  style={{
                    fontSize: "0.85rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--accent)",
                    margin: "0 0 0.75rem 0",
                  }}
                >
                  {group.subTitle}
                </h4>

                <div className="stat-grid-layout">
                  {activeKeys.map((key) => {
                    const val = stats[key] ?? 0;
                    const displayValue = isPercentage
                      ? Math.round(val * 100)
                      : val;

                    return (
                      <div key={key} className="result-card stat-row-card">
                        <span
                          className="result-label"
                          style={{
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            maxWidth: "150px",
                          }}
                        >
                          {formatLabel(key)}
                        </span>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <input
                            type="number"
                            className="stat-inline-input"
                            value={displayValue}
                            onChange={(e) => {
                              const inputNum = parseFloat(e.target.value) || 0;
                              onChange(
                                key,
                                isPercentage ? inputNum / 100 : inputNum,
                              );
                            }}
                          />
                          {isPercentage && (
                            <span
                              style={{
                                fontSize: "0.85rem",
                                color: "var(--text-muted)",
                                marginLeft: "2px",
                              }}
                            >
                              %
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
