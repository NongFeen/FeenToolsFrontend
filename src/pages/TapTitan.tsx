import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CardDefinitionDto {
  id: string; // "moon_beam"
  name: string; // "Moon Beam"
  type: string; // "Burst"
  image: string; // "/assets/taptitan/cards/moon_beam.webp"
}

interface CardEntry {
  card_id: string;
  cardtype: string;
  level: number;
}

interface PlayerData {
  player_raid_level: number;
  player_raid_base_damage: number;
  raid_set: Record<string, boolean>;
  titan_soul_research: Record<string, number>;
  raid_card_research: Record<string, number>;
  gem_stone_research: Record<string, number>;
  card_list: CardEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Shared Stat Group Panel Component ─────────────────────────────────────────

interface StatSectionProps {
  id: string; // Added to enable clean scrolling hooks
  title: string;
  description: string;
  stats: Record<string, number>;
  isPercentage?: boolean;
  onChange: (key: string, value: number) => void;
}

function StatSectionPanel({
  id,
  title,
  description,
  stats,
  isPercentage = false,
  onChange,
}: StatSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      id={id}
      className="panel"
      style={{ marginTop: "1.5rem", scrollMarginTop: "2rem" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
        }}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "0.75rem",
            marginTop: "1.25rem",
          }}
        >
          {Object.entries(stats).map(([key, val]) => {
            const displayValue = isPercentage ? Math.round(val * 100) : val;

            return (
              <div
                key={key}
                className="result-card"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                }}
              >
                <span
                  className="result-label"
                  style={{
                    fontSize: "0.8rem",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    maxWidth: "130px",
                  }}
                >
                  {formatLabel(key)}
                </span>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="number"
                    style={{
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px dashed var(--border)",
                      color: "var(--text)",
                      fontSize: "0.95rem",
                      fontWeight: "bold",
                      width: "60px",
                      textAlign: "right",
                      paddingRight: "2px",
                    }}
                    value={displayValue}
                    onChange={(e) => {
                      const inputNum = parseFloat(e.target.value) || 0;
                      const savedValue = isPercentage
                        ? inputNum / 100
                        : inputNum;
                      onChange(key, savedValue);
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
      )}
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────────────────

interface BaseStatBarProps {
  data: PlayerData;
  onStatChange: (
    key: keyof Omit<
      PlayerData,
      | "raid_set"
      | "card_list"
      | "titan_soul_research"
      | "raid_card_research"
      | "gem_stone_research"
    >,
    value: number,
  ) => void;
}

function BaseStatBar({ data, onStatChange }: BaseStatBarProps) {
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
            className="result-value"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px dashed var(--border)",
              color: "var(--text)",
              fontSize: "1.5rem",
              fontWeight: "bold",
              width: "100px",
              textAlign: "center",
            }}
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
            className="result-value"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px dashed var(--border)",
              color: "var(--text)",
              fontSize: "1.5rem",
              fontWeight: "bold",
              width: "100px",
              textAlign: "center",
            }}
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

interface CardGridProps {
  cards: CardEntry[];
  cardDefinitions: CardDefinitionDto[];
  onCardLevelChange: (cardId: string, newLevel: number) => void;
}

function CardGrid({
  cards,
  cardDefinitions,
  onCardLevelChange,
}: CardGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
        gap: "0.85rem",
        marginTop: "1.25rem",
      }}
    >
      {cards.map((card) => {
        const def = cardDefinitions.find((d) => d.id === card.card_id);
        const displayName = def
          ? def.name
          : card.card_id.replace(/([A-Z])/g, " $1").trim();

        return (
          <div
            key={card.card_id}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              overflow: "hidden",
              transition: "transform 200ms ease, box-shadow 200ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform =
                "translateY(-2px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                "0 4px 16px rgba(0,0,0,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "";
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "1",
                background: "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {def?.image ? (
                <img
                  src={`${API_BASE_URL}${def.image}`}
                  alt={displayName}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.innerText = "🃏";
                    }
                  }}
                />
              ) : (
                "🃏"
              )}
            </div>

            <div style={{ padding: "0.6rem 0.7rem" }}>
              <p
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--text)",
                  lineHeight: 1.3,
                  marginBottom: "0.2rem",
                  minHeight: "2rem",
                }}
              >
                {displayName}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span
                  style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                >
                  Lv.
                </span>
                <input
                  type="number"
                  min="0"
                  style={{
                    width: "100%",
                    fontSize: "0.75rem",
                    padding: "0.1rem 0.3rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    color: "var(--text)",
                  }}
                  value={card.level}
                  onChange={(e) =>
                    onCardLevelChange(
                      card.card_id,
                      Math.max(0, parseInt(e.target.value) || 0),
                    )
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TapTitan() {
  const [rawInput, setRawInput] = useState("");
  const [cardDefinitions, setCardDefinitions] = useState<CardDefinitionDto[]>(
    [],
  );
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDefinitions() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/taptitan/cards`);
        if (!res.ok) throw new Error("Failed to load cards metadata");
        const data: CardDefinitionDto[] = await res.json();
        setCardDefinitions(data);

        setPlayerData({
          player_raid_level: 0,
          player_raid_base_damage: 0,
          raid_set: {
            jade_anniversary: false,
            jukk_juggernaut: false,
            airforce_ace: false,
            dancer_venom: false,
            rose_anniversary: false,
          },
          titan_soul_research: {
            head_mult: 0,
            torso_mult: 0,
            limbs_mult: 0,
            armor_mult: 0,
            body_mult: 0,
            lojak_mult: 0,
            takedar_mult: 0,
            jukk_mult: 0,
            sterl_mult: 0,
            mohaca_mult: 0,
            terro_mult: 0,
            klonk_mult: 0,
            priker_mult: 0,
          },
          raid_card_research: {
            base_damage: 0,
            head_damage: 0,
            torso_damage: 0,
            limbs_damage: 0,
            armor_damage: 0,
            head_armor_damage: 0,
            torso_armor_damage: 0,
            limbs_armor_damage: 0,
            body_damage: 0,
            head_body_damage: 0,
            torso_body_damage: 0,
            limbs_body_damage: 0,
            lojak_damage: 0,
            takedar_damage: 0,
            jukk_damage: 0,
            sterl_damage: 0,
            mohaca_damage: 0,
            terro_damage: 0,
            klonk_damage: 0,
            priker_damage: 0,
            base_burst_damage: 0,
            burst_lojak_damage: 0,
            burst_takedar_damage: 0,
            burst_jukk_damage: 0,
            burst_sterl_damage: 0,
            burst_mohaca_damage: 0,
            burst_terro_damage: 0,
            burst_klonk_damage: 0,
            burst_priker_damage: 0,
            base_affliction_damage: 0,
            affliction_lojak_damage: 0,
            affliction_takedar_damage: 0,
            affliction_jukk_damage: 0,
            affliction_sterl_damage: 0,
            affliction_mohaca_damage: 0,
            affliction_terro_damage: 0,
            affliction_klonk_damage: 0,
            affliction_priker_damage: 0,
          },
          gem_stone_research: {
            base_damage: 0,
            head_damage: 0,
            torso_damage: 0,
            limbs_damage: 0,
            armor_damage: 0,
            head_armor_damage: 0,
            torso_armor_damage: 0,
            limbs_armor_damage: 0,
            body_damage: 0,
            head_body_damage: 0,
            torso_body_damage: 0,
            limbs_body_damage: 0,
            lojak_damage: 0,
            takedar_damage: 0,
            jukk_damage: 0,
            sterl_damage: 0,
            mohaca_damage: 0,
            terro_damage: 0,
            klonk_damage: 0,
            priker_damage: 0,
            base_burst_damage: 0,
            burst_lojak_damage: 0,
            burst_takedar_damage: 0,
            burst_jukk_damage: 0,
            burst_sterl_damage: 0,
            burst_mohaca_damage: 0,
            burst_terro_damage: 0,
            burst_klonk_damage: 0,
            burst_priker_damage: 0,
            base_affliction_damage: 0,
            affliction_lojak_damage: 0,
            affliction_takedar_damage: 0,
            affliction_jukk_damage: 0,
            affliction_sterl_damage: 0,
            affliction_mohaca_damage: 0,
            affliction_terro_damage: 0,
            affliction_klonk_damage: 0,
            affliction_priker_damage: 0,
          },
          card_list: data.map((c) => ({
            card_id: c.id,
            cardtype: c.type,
            level: 0,
          })),
        });
      } catch (err) {
        console.error("[ERROR] Baseline framework build failed:", err);
      }
    }
    loadDefinitions();
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const parsed = JSON.parse(rawInput);
      const res = await fetch(`${API_BASE_URL}/api/taptitan/player_data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const json = await res.json();
      if (json && json.data && json.data.data) {
        setPlayerData(json.data.data as PlayerData);
      } else {
        throw new Error("Unexpected response envelope from server");
      }

      scrollToSection("section-multipliers");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleCardLevelChange = (cardId: string, newLevel: number) => {
    if (!playerData) return;
    setPlayerData({
      ...playerData,
      card_list: playerData.card_list.map((c) =>
        c.card_id === cardId ? { ...c, level: newLevel } : c,
      ),
    });
  };

  const handleBaseStatChange = (
    key: keyof Omit<
      PlayerData,
      | "raid_set"
      | "card_list"
      | "titan_soul_research"
      | "raid_card_research"
      | "gem_stone_research"
    >,
    value: number,
  ) => {
    if (!playerData) return;
    setPlayerData({ ...playerData, [key]: value });
  };

  const handleSubStatChange = (
    category:
      | "titan_soul_research"
      | "raid_card_research"
      | "gem_stone_research",
    key: string,
    value: number,
  ) => {
    if (!playerData) return;
    setPlayerData({
      ...playerData,
      [category]: {
        ...playerData[category],
        [key]: value,
      },
    });
  };

  return (
    <div className="page">
      <Navbar />

      <div
        className="layout"
        style={{ display: "flex", alignItems: "flex-start", gap: "2rem" }}
      >
        {/* ── STICKY SIDEBAR NAVIGATION ── */}
        <aside
          className="sidebar"
          style={{
            position: "sticky",
            top: "2rem",
            maxHeight: "calc(100vh - 4rem)",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem",
          }}
        >
          <p className="sidebar-label">Tools</p>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-import")}
          >
            <span>📥</span> Import Data
          </button>

          <p className="sidebar-label" style={{ marginTop: "1rem" }}>
            Dashboard Index
          </p>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-multipliers")}
          >
            <span>📊</span> Multipliers
          </button>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-titan-soul")}
          >
            <span>🧬</span> Titan Soul Research
          </button>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-raid-card")}
          >
            <span>🃏</span> Raid Card Bonus
          </button>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-gem-stone")}
          >
            <span>💎</span> Gem Stone Bonus
          </button>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-card-vault")}
          >
            <span>📦</span> Card Vault Deck
          </button>
        </aside>

        {/* Content Wrapper */}
        <main className="content" style={{ flex: 1, minWidth: 0 }}>
          {/* Section 1 — Data Import */}
          <section
            id="section-import"
            className="panel"
            style={{ scrollMarginTop: "2rem" }}
          >
            <h2 className="panel-title">Import Player Data</h2>
            <p className="panel-desc">
              Paste raw TapTitan 2 player profile export JSON code below.
            </p>
            <textarea
              className="code-area"
              rows={10}
              placeholder={
                '{\n  "playerStats": { ... },\n  "raidCards": { ... }\n}'
              }
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              spellCheck={false}
            />
            {error && <div className="error-box">{error}</div>}
            <button
              className="calc-btn"
              onClick={handleSubmit}
              disabled={loading || !rawInput.trim()}
              style={{ marginTop: "1rem" }}
            >
              {loading ? "Processing Data…" : "Parse & Clean Input →"}
            </button>
          </section>

          {/* Dashboard Container */}
          <div id="section-dashboard" style={{ marginTop: "2rem" }}>
            {!playerData ? (
              <div className="panel">
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.875rem",
                    margin: 0,
                  }}
                >
                  Constructing baseline stats dashboard framework...
                </p>
              </div>
            ) : (
              <>
                {/* Base Player Account Stats */}
                <div
                  id="section-multipliers"
                  className="panel"
                  style={{ scrollMarginTop: "2rem" }}
                >
                  <h2 className="panel-title">Account Base Multipliers</h2>
                  <p className="panel-desc">
                    Tweak fundamental raid performance scalars.
                  </p>
                  <BaseStatBar
                    data={playerData}
                    onStatChange={handleBaseStatChange}
                  />
                </div>

                {/* 1. Titan Soul Research Panel */}
                <StatSectionPanel
                  id="section-titan-soul"
                  title="Titan Soul Research"
                  description="Anatomical location and Titan Lord target multipliers (Percentages)."
                  stats={playerData.titan_soul_research}
                  isPercentage={true}
                  onChange={(k, v) =>
                    handleSubStatChange("titan_soul_research", k, v)
                  }
                />

                {/* 2. Raid Card Research Panel */}
                <StatSectionPanel
                  id="section-raid-card"
                  title="Raid Card Research Bonus"
                  description="Flat card capability level tracking milestones."
                  stats={playerData.raid_card_research}
                  onChange={(k, v) =>
                    handleSubStatChange("raid_card_research", k, v)
                  }
                />

                {/* 3. Gem Stone Research Panel */}
                <StatSectionPanel
                  id="section-gem-stone"
                  title="Gem Stone Research Bonus"
                  description="Flat talent stone alignment progression attributes."
                  stats={playerData.gem_stone_research}
                  onChange={(k, v) =>
                    handleSubStatChange("gem_stone_research", k, v)
                  }
                />

                {/* Card Management Inventory Grid */}
                <div
                  id="section-card-vault"
                  className="panel"
                  style={{ marginTop: "1.5rem", scrollMarginTop: "2rem" }}
                >
                  <h2 className="panel-title">Card Vault Deck</h2>
                  <p className="panel-desc">
                    Active level configuration values per deck piece.
                  </p>
                  <CardGrid
                    cards={playerData.card_list}
                    cardDefinitions={cardDefinitions}
                    onCardLevelChange={handleCardLevelChange}
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
