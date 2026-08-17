import type { LiveCurrentBoss } from "../api/types";

interface Props {
  boss: LiveCurrentBoss | null;
  refreshing: boolean;
  onRefresh: () => void;
}

const formatHp = (value: number) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 3,
  }).format(value);

export default function LiveCurrentBossPanel({ boss, refreshing, onRefresh }: Props) {
  return (
    <section id="section-live-boss" className="panel scroll-target">
      <div className="panel-heading-row">
        <div>
          <h2 className="panel-title">Current Boss Data</h2>
          <p className="panel-desc">
            Read-only live state from the latest attack event. It is kept only
            in backend memory and is not used by simulations.
          </p>
        </div>
        <div className="live-boss-actions">
          {boss && <small>Received {new Date(boss.received_at).toLocaleString()}</small>}
          <button className="secondary-btn" type="button" disabled={refreshing} onClick={onRefresh}>
            {refreshing ? "Refreshing…" : "Refresh current boss"}
          </button>
        </div>
      </div>

      {!boss && (
        <div className="empty-state live-boss-empty">
          Waiting for the next attack event. This data is cleared when the
          backend restarts.
        </div>
      )}

      {boss && (
        <>
          <dl className="live-boss-facts">
            <div><dt>Enemy</dt><dd>{boss.boss_data.enemy_id}</dd></div>
            <div><dt>Titan index</dt><dd>{boss.titan_index}</dd></div>
            <div><dt>Cycle</dt><dd>{boss.cycle}</dd></div>
            <div><dt>Current total HP</dt><dd>{formatHp(boss.boss_data.current_hp)}</dd></div>
            <div><dt>Raid</dt><dd>{boss.raid_id}</dd></div>
            <div><dt>Clan</dt><dd>{boss.clan_code}</dd></div>
          </dl>
          <div className="live-boss-parts" aria-label="Live boss part health">
            {boss.boss_data.parts.map((part) => (
              <div key={part.part_id} className="live-boss-part">
                <span>{part.part_id}</span>
                <strong>{formatHp(part.current_hp)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
