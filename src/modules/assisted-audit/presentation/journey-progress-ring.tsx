export function JourneyProgressRing({ progress }: { progress: number }) {
  return (
    <div
      className="journey-progress-ring"
      role="progressbar"
      aria-label="Progression validée de l’audit"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="journey-ring-track" cx="60" cy="60" r="50" />
        <circle
          className="journey-ring-value"
          cx="60"
          cy="60"
          r="50"
          pathLength="100"
          strokeDasharray={`${progress} 100`}
        />
      </svg>
      <div>
        <strong>{progress}%</strong>
        <span>validé</span>
      </div>
    </div>
  );
}
