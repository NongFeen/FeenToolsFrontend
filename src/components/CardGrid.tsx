import { assetUrl } from "../api/client";
import type { CardEntry, CardDefinitionDto } from "../dto/CardDefinitionDto";

interface CardGridProps {
  cards: CardEntry[];
  cardDefinitions: CardDefinitionDto[];
  onCardLevelChange: (cardId: string, newLevel: number) => void;
  onCardEnabledChange: (cardId: string, enabled: boolean) => void;
}

export default function CardGrid({ cards, cardDefinitions, onCardLevelChange, onCardEnabledChange }: CardGridProps) {
  return (
    <div className="card-vault-grid">
      {cards.map((card) => {
        const def = cardDefinitions.find((definition) => definition.id === card.card_id);
        const displayName = def?.name ?? card.card_id.replace(/([A-Z])/g, " $1").trim();
        return (
          <div key={card.card_id} className={`vault-card${card.enabled === false ? " vault-card-disabled" : ""}`}>
            <div className="vault-card-image-wrap">
              {def?.image ? <img src={assetUrl(def.image)} alt={`${displayName} raid card`} loading="lazy" /> : <span className="image-placeholder">Image unavailable</span>}
            </div>
            <div className="vault-card-body">
              <p>{displayName}</p>
              <label className="vault-card-enabled">
                <input
                  type="checkbox"
                  checked={card.enabled !== false}
                  onChange={(event) => onCardEnabledChange(card.card_id, event.target.checked)}
                />
                <span>Use card</span>
              </label>
              <label><span>Level</span><input type="number" min="0" className="vault-card-input" value={card.level} onChange={(event) => onCardLevelChange(card.card_id, Math.max(0, Number.parseInt(event.target.value) || 0))} /></label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
