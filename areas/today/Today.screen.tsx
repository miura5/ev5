import { TodayView } from "./Today.view.tsx";

const none = () => undefined;
const dateLabel = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Chicago",
  });

/** The mounted view until the data wiring lands: an empty day with no plan, suggestion or dates. */
export function TodayScreen() {
  return (
    <TodayView
      dateLabel={dateLabel()}
      say={{
        lead: "Nothing planned yet.",
        rest: "Your plan for today will appear here.",
      }}
      plan={[]}
      upcoming={[]}
      thisWeek={[]}
      onStartNext={none}
      onOpen={none}
      onAccept={none}
      onEdit={none}
      onDismiss={none}
    />
  );
}
