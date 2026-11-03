import { useState } from "react";
import { StudyCard } from "./StudyCard";

export function Story() {
  const [turned, setTurned] = useState(false);
  const [flipped, setFlipped] = useState(false);
  return (
    <div data-ui="story-study-card">
      <StudyCard
        kicker="Term"
        face="Cardiac output"
        answer={turned ? "Heart rate times stroke volume." : undefined}
        from="Cardiac output terms"
        onTurn={() => setTurned(true)}
      />
      <StudyCard
        kicker="Term"
        face="Stroke volume"
        answer={flipped ? "Blood ejected per beat." : undefined}
        hero={{
          position: 2,
          total: 8,
          onFlip: () => setFlipped(!flipped),
          onPrev: () => undefined,
          onNext: () => undefined,
        }}
      />
    </div>
  );
}
