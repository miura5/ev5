import "./progress.css";

/** Progress: one line until the accuracy chart has data to draw (read-only, no writes). */
export function ProgressScreen() {
  return (
    <section className="ev-progress" data-ui="progress">
      <div className="ev-progress-head">
        <h1 className="ev-progress-title">Progress</h1>
        <span className="ev-progress-meta">accuracy over time</span>
      </div>
      <p className="ev-progress-line">
        Your accuracy over time will show here once you have answered some
        practice questions.
      </p>
    </section>
  );
}
