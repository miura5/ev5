import { PracticeCard } from "./PracticeCard";

export function Story() {
  return (
    <div data-ui="story-practice-card">
      <PracticeCard
        title="Market structure"
        question="Which change most often raises the price of a good?"
        position={2}
        total={8}
        options={["Rising demand", "Falling demand", "A new substitute", "Lower income"]}
        source="Note · Market structure"
        hint="Think about what buyers do when they want more."
        onCommit={() => undefined}
        onEnd={() => undefined}
      />
    </div>
  );
}
