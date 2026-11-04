/** Progress: one line until the accuracy chart has data to draw (read-only, no writes). */
export function ProgressScreen() {
  return (
    <section data-ui="progress">
      <h1>Progress</h1>
      <p>
        Your accuracy over time will show here once you have answered some
        practice questions.
      </p>
    </section>
  );
}
