import { useState } from "react";
import { StudyCard } from "./StudyCard";

export function Story() {
  const [turned, setTurned] = useState(false);
  const [flipped, setFlipped] = useState(false);
  return (
    <div data-ui="story-study-card">
      <StudyCard
        kicker="Term"
        face="Supply and demand"
        answer={turned ? "Price falls when supply rises." : undefined}
        from="Supply and demand terms"
        onTurn={() => setTurned(true)}
      />
      <StudyCard
        kicker="Term"
        face="Scarcity"
        answer={flipped ? "Wanting more than exists." : undefined}
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
