import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SimulationQueue, SimulationQueueEntry } from "../api/types";

const QUEUE_POLL_INTERVAL_MS = 5_000;

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

const statusLabel = (entry: SimulationQueueEntry) => {
  switch (entry.status) {
    case "running":
      return "Simulating";
    case "optimizing":
      return "Building recommendation";
    case "pending":
      return entry.position !== null ? `Waiting · #${entry.position}` : "Waiting";
    case "completed":
      return "Done";
    case "failed":
      return "Failed";
  }
};

interface SimulationQueueWidgetProps {
  queue: SimulationQueue | null;
  error: string;
}

export default function SimulationQueueWidget({ queue, error }: SimulationQueueWidgetProps) {
  // The API returns most-recently-finished first; show earliest-first so the
  // top of the list is whoever got their sim first.
  const finishOrder = queue ? [...queue.recently_completed].reverse() : [];

  return (
    <section className="simulation-queue-card" aria-label="Simulation queue">
      <div className="simulation-queue-column">
        <span>Queue</span>
        {error && <strong className="simulation-queue-error">{error}</strong>}
        {!error && queue && queue.active.length === 0 && (
          <strong>No simulations waiting.</strong>
        )}
        {queue?.active.map((entry) => (
          <div className="simulation-queue-row" key={entry.job_id}>
            <strong>{entry.display_name}</strong>
            <small>
              {statusLabel(entry)} · since {formatTime(entry.created_at)}
            </small>
          </div>
        ))}
      </div>
      <div className="simulation-queue-column">
        <span>Finished (first first)</span>
        {finishOrder.length === 0 && !error && <strong>Nothing finished yet.</strong>}
        {finishOrder.map((entry, index) => (
          <div className="simulation-queue-row" key={entry.job_id}>
            <strong>
              {index + 1}. {entry.display_name}
            </strong>
            <small>{formatTime(entry.completed_at)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
