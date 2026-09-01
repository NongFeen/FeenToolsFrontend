import type { SimulationJob } from "../api/types";
import { isActiveJob } from "../utils/taptitan";

export default function JobStatus({ job, emptyMessage = "No simulation has been run yet." }: { job: SimulationJob | null; emptyMessage?: string }) {
  if (!job) return <div className="empty-state compact-empty">{emptyMessage}</div>;
  const active = isActiveJob(job);
  const bodyPhaseRan = job.result?.body_phase_ran;
  return (
    <div className={`job-status status-${job.status}`} role="status" aria-live="polite">
      <div>
        <span className="eyebrow">Latest simulation</span>
        <div className="job-status-line">
          {active && <span className="spinner" aria-hidden="true" />}
          <strong>{job.status}</strong><span>Attempt {job.attempts}</span>
        </div>
      </div>
      <div className="job-meta"><span>Simulator {job.simulator_version}</span>{typeof bodyPhaseRan === "boolean" && <span>Body phase: {bodyPhaseRan ? "ran" : "skipped"}</span>}<span>{new Date(job.updated_at).toLocaleString()}</span></div>
      {job.status === "failed" && <p className="job-error">{job.error_message || "Simulation failed without an error message."}</p>}
    </div>
  );
}
