import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SimulationQueue, SimulationQueueEntry } from "../api/types";

const QUEUE_POLL_INTERVAL_MS = 5_000;
const NEXT_UP_LIMIT = 6;

export const useSimulationQueue = () => {
  const [queue, setQueue] = useState<SimulationQueue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .simulationQueue()
        .then((data) => {
          if (!active) return;
          setQueue(data);
          setError("");
        })
        .catch(() => {
          if (active) setError("Could not load the simulation queue.");
        });

    void load();
    const intervalId = window.setInterval(load, QUEUE_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return { queue, error };
};

const formatTime = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const isRunning = (entry: SimulationQueueEntry) =>
  entry.status === "running" || entry.status === "optimizing";

interface SimulationQueueWidgetProps {
  queue: SimulationQueue | null;
  error: string;
}

export default function SimulationQueueWidget({ queue, error }: SimulationQueueWidgetProps) {
  if (error) {
    return (
      <section className="simulation-queue-card" aria-label="Simulation queue">
        <strong className="simulation-queue-error">{error}</strong>
      </section>
    );
  }
  if (!queue) return null;

  const running = queue.active.filter(isRunning);
  const waiting = queue.active.filter((entry) => entry.status === "pending");
  // Most recently finished first from the API; show earliest-first so the top
  // of the list is whoever got their sim first.
  const finished = [...queue.recently_completed].reverse();
  const nextUp = waiting.slice(0, NEXT_UP_LIMIT);
  const moreWaiting = waiting.length - nextUp.length;

  return (
    <section className="simulation-queue-card" aria-label="Simulation queue">
      <header className="simulation-queue-summary">
        <span>
          <strong>{waiting.length}</strong> waiting
        </span>
        <span>
          <strong>{running.length}</strong> running
        </span>
        <span>
          <strong>{finished.length}</strong> finished
        </span>
      </header>

      {running.length > 0 && (
        <div className="simulation-queue-running">
          {running.map((entry) => (
            <span className="simulation-queue-chip is-running" key={entry.job_id}>
              {entry.display_name}
              <small>{entry.status === "optimizing" ? "building" : "simulating"}</small>
            </span>
          ))}
        </div>
      )}

      {nextUp.length > 0 && (
        <div className="simulation-queue-next">
          <span className="simulation-queue-label">Next up</span>
          <div className="simulation-queue-chips">
            {nextUp.map((entry) => (
              <span className="simulation-queue-chip" key={entry.job_id}>
                <em>#{entry.position}</em> {entry.display_name}
              </span>
            ))}
            {moreWaiting > 0 && (
              <span className="simulation-queue-chip is-more">+{moreWaiting} more</span>
            )}
          </div>
        </div>
      )}

      {queue.active.length === 0 && (
        <p className="simulation-queue-empty">No simulations waiting.</p>
      )}

      <div className="simulation-queue-lists">
        <div className="simulation-queue-list">
          <span className="simulation-queue-label">Waiting ({waiting.length})</span>
          {waiting.length === 0 ? (
            <small className="simulation-queue-empty">Nobody waiting.</small>
          ) : (
            <ol>
              {waiting.map((entry) => (
                <li key={entry.job_id}>
                  <span>
                    <em>#{entry.position}</em> {entry.display_name}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="simulation-queue-list">
          <span className="simulation-queue-label">Finished, first first</span>
          {finished.length === 0 ? (
            <small className="simulation-queue-empty">Nothing finished yet.</small>
          ) : (
            <ol>
              {finished.map((entry) => (
                <li key={entry.job_id}>
                  <span>{entry.display_name}</span>
                  <small>{formatTime(entry.completed_at)}</small>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
