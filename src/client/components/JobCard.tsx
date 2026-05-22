import * as Progress from "@radix-ui/react-progress";
import type { ConversionJob } from "../../shared/types";

interface Props {
  job: ConversionJob;
  onDismiss: () => void;
}

export function JobCard({ job, onDismiss }: Props) {
  const done = job.files.filter((f) => f.status === "completed").length;
  const failed = job.files.filter((f) => f.status === "failed").length;
  const total = job.files.length;
  const pct = Math.round(((done + failed) / total) * 100);
  const isRunning = job.status === "processing" || job.status === "pending";

  return (
    <div className={`job-card job-card--${job.status}`}>
      <div className="job-card-header">
        <div>
          <h2 className="job-card-title">
            Converting to <span className="job-card-fmt">{job.targetFormat.toUpperCase()}</span>
          </h2>
          <p className="job-card-meta">
            {done} of {total} done{failed > 0 && ` · ${failed} failed`}
          </p>
        </div>
        {!isRunning && (
          <div className="job-card-actions">
            {done >= 1 && (
              <a className="job-card-dl-all" href={`/api/jobs/${job.id}/download`} download="converted.zip">
                ↓ Download all
              </a>
            )}
            <button className="job-card-reset" onClick={onDismiss} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
      </div>

      {isRunning && (
        <Progress.Root className="prog-root" value={pct}>
          <Progress.Indicator
            className="prog-bar"
            style={{ transform: `translateX(-${100 - pct}%)` }}
          />
        </Progress.Root>
      )}

      <ul className="job-files">
        {job.files.map((f) => (
          <li key={f.id} className={`job-file job-file--${f.status}`}>
            <span className="job-file-dot" />
            <span className="job-file-name">{f.originalName}</span>
            <span className="job-file-action">
              {f.status === "completed" && (
                <a
                  className="job-file-dl"
                  href={`/api/jobs/${job.id}/files/${f.id}`}
                  download
                >
                  Download
                </a>
              )}
              {f.status === "failed" && (
                <span className="job-file-err" title={f.error}>Failed</span>
              )}
              {(f.status === "pending" || f.status === "processing") && (
                <span className="job-file-spin">Converting…</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
