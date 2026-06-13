import { useState } from "react";

type PartState = "Cursed" | "Armor" | "Body" | "Skeleton";
interface BossPartConfig {
  partName: string;
  partState: PartState;
  isAttack: boolean;
  maxArmor: number;
  maxHealth: number;
  currentArmor: number;
  currentHealth: number;
}

const PART_NAMES = [
  "Head",
  "Torso",
  "LeftShoulder",
  "RightShoulder",
  "LeftHand",
  "RightHand",
  "LeftLeg",
  "RightLeg",
];

const INITIAL_PARTS: BossPartConfig[] = PART_NAMES.map((name) => ({
  partName: name,
  partState: "Armor",
  isAttack: true,
  maxArmor: 1000000,
  maxHealth: 1000000,
  currentArmor: 1000000,
  currentHealth: 1000000,
}));

export default function BossSettingPanel() {
  const [bossName, setBossName] = useState("Lojak");
  const [parts, setParts] = useState<BossPartConfig[]>(INITIAL_PARTS);

  const updatePart = (index: number, changes: Partial<BossPartConfig>) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], ...changes };
    setParts(newParts);
  };

  const handleExport = () => {
    const data = {
      bossName,
      parts,
      exportedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(data, null, 2);
    console.log("Boss State JSON:", data);

    // Create download
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boss_state_${bossName.toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    alert("JSON exported to console and file download started.");
  };

  return (
    <section
      id="section-boss"
      className="panel scroll-target"
      style={{ marginTop: "1.5rem" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 className="panel-title">Boss Configuration</h2>
        <button
          className="btn-primary"
          onClick={handleExport}
          style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}
        >
          📥 Export Boss JSON
        </button>
      </div>
      <p className="panel-desc">
        Set the current status, health, and armor for all 8 titan parts.
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Titan Name
        </label>
        <select
          className="code-area"
          style={{
            padding: "0.5rem",
            width: "100%",
            height: "auto",
            marginTop: "0.3rem",
          }}
          value={bossName}
          onChange={(e) => setBossName(e.target.value)}
        >
          {[
            "Lojak",
            "Takedar",
            "Jukk",
            "Sterl",
            "Mohaca",
            "Terro",
            "Klonk",
            "Priker",
          ].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.85rem",
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: "left",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <th style={{ padding: "0.5rem" }}>Part</th>
              <th style={{ padding: "0.5rem" }}>Status</th>
              <th style={{ padding: "0.5rem" }}>Target?</th>
              <th style={{ padding: "0.5rem" }}>Max Armor/HP</th>
              <th style={{ padding: "0.5rem" }}>Current Armor/HP</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part, idx) => (
              <tr
                key={part.partName}
                style={{ borderBottom: "1px solid var(--border-color)" }}
              >
                <td style={{ padding: "0.5rem", fontWeight: "bold" }}>
                  {part.partName}
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <select
                    value={part.partState}
                    onChange={(e) =>
                      updatePart(idx, {
                        partState: e.target.value as PartState,
                      })
                    }
                    style={{
                      background: "#222",
                      color: "#fff",
                      border: "1px solid #444",
                    }}
                  >
                    <option value="Armor">Armor</option>
                    <option value="Body">Body</option>
                    <option value="Cursed">Cursed</option>
                    <option value="Skeleton">Skeleton</option>
                  </select>
                </td>
                <td style={{ padding: "0.5rem", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={part.isAttack}
                    onChange={(e) =>
                      updatePart(idx, { isAttack: e.target.checked })
                    }
                  />
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <input
                      type="number"
                      value={part.maxArmor}
                      onChange={(e) =>
                        updatePart(idx, {
                          maxArmor: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Max Armor"
                      style={{
                        width: "80px",
                        background: "#111",
                        border: "1px solid #333",
                        color: "#888",
                      }}
                    />
                    <input
                      type="number"
                      value={part.maxHealth}
                      onChange={(e) =>
                        updatePart(idx, {
                          maxHealth: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="Max HP"
                      style={{
                        width: "80px",
                        background: "#111",
                        border: "1px solid #333",
                        color: "#888",
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <input
                      type="number"
                      value={part.currentArmor}
                      onChange={(e) =>
                        updatePart(idx, {
                          currentArmor: parseInt(e.target.value) || 0,
                        })
                      }
                      style={{
                        width: "80px",
                        background: "#111",
                        border: "1px solid #333",
                        color: "#fff",
                      }}
                    />
                    <input
                      type="number"
                      value={part.currentHealth}
                      onChange={(e) =>
                        updatePart(idx, {
                          currentHealth: parseInt(e.target.value) || 0,
                        })
                      }
                      style={{
                        width: "80px",
                        background: "#111",
                        border: "1px solid #333",
                        color: "#fff",
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          marginTop: "1rem",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
        }}
      >
        * Skeleton parts cannot be attacked. Values are saved in current
        session.
      </div>
    </section>
  );
}
