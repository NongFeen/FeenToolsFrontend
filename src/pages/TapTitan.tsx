import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import BaseStatBar from "../components/BaseStatBar";
import GroupedStatSectionPanel from "../components/GroupedStatPanel";
import CardGrid from "../components/CardGrid";
import {
  type PlayerData,
  TITAN_SOUL_GROUPS,
  CARD_AND_GEM_GROUPS,
  type CardDefinitionDto,
} from "../dto/CardDefinitionDto";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
          titan_soul_research: Object.fromEntries(
            TITAN_SOUL_GROUPS.flatMap((g) => g.keys).map((k) => [k, 0]),
          ),
          raid_card_research: Object.fromEntries(
            CARD_AND_GEM_GROUPS.flatMap((g) => g.keys).map((k) => [k, 0]),
          ),
          gem_stone_research: Object.fromEntries(
            CARD_AND_GEM_GROUPS.flatMap((g) => g.keys).map((k) => [k, 0]),
          ),
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

  const scrollToSection = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

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
      if (json?.data?.data) {
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

  return (
    <div className="page">
      <Navbar />

      <div className="layout">
        <aside className="sidebar">
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
            <span>🧬</span> Titan Soul
          </button>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-raid-card")}
          >
            <span>🃏</span> Raid Card
          </button>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-gem-stone")}
          >
            <span>💎</span> Gem Stone
          </button>
          <button
            className="side-btn"
            onClick={() => scrollToSection("section-card-vault")}
          >
            <span>📦</span> Card Vault
          </button>
        </aside>

        <main className="content">
          <section id="section-import" className="panel scroll-target">
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
                <div id="section-multipliers" className="panel scroll-target">
                  <h2 className="panel-title">Account Base Multipliers</h2>
                  <p className="panel-desc">
                    Tweak fundamental raid performance scalars.
                  </p>
                  <BaseStatBar
                    data={playerData}
                    onStatChange={(k, v) =>
                      setPlayerData({ ...playerData, [k]: v })
                    }
                  />
                </div>

                <GroupedStatSectionPanel
                  id="section-titan-soul"
                  title="Titan Soul Research"
                  description="Anatomical location and Titan Lord target multipliers (Percentages)."
                  stats={playerData.titan_soul_research}
                  structureGroups={TITAN_SOUL_GROUPS}
                  isPercentage={true}
                  onChange={(k, v) =>
                    setPlayerData({
                      ...playerData,
                      titan_soul_research: {
                        ...playerData.titan_soul_research,
                        [k]: v,
                      },
                    })
                  }
                />

                <GroupedStatSectionPanel
                  id="section-raid-card"
                  title="Raid Card Research Bonus"
                  description="Flat card capability level tracking milestones separated by scaling categories."
                  stats={playerData.raid_card_research}
                  structureGroups={CARD_AND_GEM_GROUPS}
                  onChange={(k, v) =>
                    setPlayerData({
                      ...playerData,
                      raid_card_research: {
                        ...playerData.raid_card_research,
                        [k]: v,
                      },
                    })
                  }
                />

                <GroupedStatSectionPanel
                  id="section-gem-stone"
                  title="Gem Stone Research Bonus"
                  description="Flat talent stone alignment progression attributes separated by scaling categories."
                  stats={playerData.gem_stone_research}
                  structureGroups={CARD_AND_GEM_GROUPS}
                  onChange={(k, v) =>
                    setPlayerData({
                      ...playerData,
                      gem_stone_research: {
                        ...playerData.gem_stone_research,
                        [k]: v,
                      },
                    })
                  }
                />

                <div
                  id="section-card-vault"
                  className="panel scroll-target"
                  style={{ marginTop: "1.5rem" }}
                >
                  <h2 className="panel-title">Card Vault Deck</h2>
                  <p className="panel-desc">
                    Active level configuration values per deck piece.
                  </p>
                  <CardGrid
                    cards={playerData.card_list}
                    cardDefinitions={cardDefinitions}
                    onCardLevelChange={(id, lvl) =>
                      setPlayerData({
                        ...playerData,
                        card_list: playerData.card_list.map((c) =>
                          c.card_id === id ? { ...c, level: lvl } : c,
                        ),
                      })
                    }
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
