import { PracticeCard } from "./PracticeCard";

export function Story() {
  return (
    <div data-ui="story-practice-card">
      <PracticeCard
        title="Fluid balance"
        question="Which sign most suggests fluid volume deficit?"
        position={2}
        total={8}
        options={["Bounding pulse", "Flat neck veins", "Crackles", "Edema"]}
        source="Note · Fluid balance"
        hint="Think about what low volume does to the veins."
        onCommit={() => undefined}
        onEnd={() => undefined}
      />
    </div>
  );
}
