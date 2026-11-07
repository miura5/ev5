import { Horizon, type HorizonDay } from "./Horizon";

const EXAM = { title: "Biology exam 3", tag: "Exam 3", when: "Thu" };
const INTERVIEW = { title: "Job interview", tag: "Interview", when: "Nov 9" };
const DUE = [4, 9, 6, 2, 3, 1, 4, 5, 2, 3, 1, 2, 0, 2];
const SHORT = ["Today", "3", "4", "Thu 5", "6", "7", "8", "Mon 9", "10", "11", "12", "13", "14", "15"];
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const SAMPLE_DAYS: HorizonDay[] = DUE.map((due, i) => ({
  label: i === 0 ? "Today" : `${WEEK[i % 7]} Nov ${i + 2}`,
  short: SHORT[i],
  due,
  post: i === 3 ? EXAM : i === 7 ? INTERVIEW : undefined,
}));

export function Story() {
  return (
    <div data-ui="story-horizon" style={{ display: "grid", gap: "var(--sp-6)" }}>
      <div style={{ width: "var(--side-w)", background: "var(--side)", padding: "var(--sp-2)" }}>
        <Horizon days={SAMPLE_DAYS} show="dates" onOpen={() => {}} />
      </div>
      <div style={{ width: "var(--side-w)", background: "var(--side)", padding: "var(--sp-2)" }}>
        <Horizon days={SAMPLE_DAYS} onOpen={() => {}} />
      </div>
      <div style={{ width: 672 }}>
        <Horizon days={SAMPLE_DAYS} size="wide" />
      </div>
    </div>
  );
}
