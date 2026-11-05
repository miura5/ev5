import { Bars } from "./Bars";

export function Story() {
  return (
    <div data-ui="story-bars" style={{ maxWidth: "calc(var(--sp-12) * 12)" }}>
      <Bars
        label="Study minutes, last 7 days"
        bars={[
          { label: "Tue", value: 40 },
          { label: "Wed", value: 75 },
          { label: "Thu", value: 20 },
          { label: "Fri", value: 110 },
          { label: "Sat", value: 0 },
          { label: "Sun", value: 55 },
          { label: "Today", value: 70 },
        ]}
      />
    </div>
  );
}
