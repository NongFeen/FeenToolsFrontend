import type { CardEntry, CardDefinitionDto } from "../dto/CardDefinitionDto";

interface CardGridProps {
  cards: CardEntry[];
  cardDefinitions: CardDefinitionDto[];
  onCardLevelChange: (cardId: string, newLevel: number) => void;
}

export default function CardGrid({
  cards,
  cardDefinitions,
  onCardLevelChange,
}: CardGridProps) {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  return (
    <div className="card-vault-grid">
      {cards.map((card) => {
        const def = cardDefinitions.find((d) => d.id === card.card_id);
        const displayName = def
          ? def.name
          : card.card_id.replace(/([A-Z])/g, " $1").trim();

        return (
          <div key={card.card_id} className="vault-card">
            <div className="vault-card-image-wrap">
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
                    e.currentTarget.style.display = "none";
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
                  className="vault-card-input"
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
