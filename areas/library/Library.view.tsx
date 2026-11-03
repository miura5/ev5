import { useState } from "react";
import { Glyph, Row } from "../../kit/index.ts";
import { MasteryBar } from "./parts/MasteryBar.tsx";
import { PracticePanel } from "./parts/PracticePanel.tsx";
import type { LibraryExam, PracticeSession, WeakSpot } from "./types.ts";
import "./library.css";

export type {
  LibraryExam,
  PracticeSession,
  WeakSpot,
} from "./types.ts";

export interface LibraryViewProps {
  practice: PracticeSession | null;
  weakSpots: readonly WeakSpot[];
  exams: readonly LibraryExam[];
  onCommit?: (option: string) => void;
  onEndPractice?: () => void;
  onDrill?: (id: string) => void;
  onOpenExam?: (id: string) => void;
}

type Tab = "practice" | "weak" | "exams";

/** Library home, first slice: practice, weak spots and exams. Sets, the accuracy line and exam plans follow. */
export function LibraryView({
  practice,
  weakSpots,
  exams,
  onCommit,
  onEndPractice,
  onDrill,
  onOpenExam,
}: LibraryViewProps) {
  const [tab, setTab] = useState<Tab>("practice");
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "practice", label: "Practice" },
    { id: "weak", label: "Weak spots", n: weakSpots.length },
    { id: "exams", label: "Exams", n: exams.length },
  ];
  return (
    <section className="ev-library" aria-label="Library">
      <div className="ev-library-head">
        <h1 className="ev-library-title">Library</h1>
        <span className="ev-library-meta">
          practice, weak spots, exams and sets
        </span>
      </div>
      <div className="ev-library-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className="ev-library-tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.n ? <span className="ev-library-meta"> · {t.n}</span> : null}
          </button>
        ))}
      </div>
      <div className="ev-library-panel" data-panel={tab}>
        {tab === "practice" ? (
          <PracticePanel
            session={practice}
            onCommit={onCommit}
            onEnd={onEndPractice}
          />
        ) : null}
        {tab === "weak" && weakSpots.length === 0 ? (
          <span className="ev-library-meta">No weak spots.</span>
        ) : null}
        {tab === "weak"
          ? weakSpots.map((w) => (
              <div className="ev-library-line" key={w.id}>
                <Row
                  title={w.title}
                  meta={w.meta}
                  value={w.due}
                  glyph={<Glyph type="questions" />}
                  onOpen={onDrill ? () => onDrill(w.id) : undefined}
                />
                <MasteryBar mastery={w.mastery} />
              </div>
            ))
          : null}
        {tab === "exams" && exams.length === 0 ? (
          <span className="ev-library-meta">No exams.</span>
        ) : null}
        {tab === "exams"
          ? exams.map((x) => (
              <div className="ev-library-line" key={x.id}>
                <Row
                  title={x.title}
                  meta={x.meta}
                  value={x.readiness}
                  glyph={<Glyph type="date" />}
                  onOpen={onOpenExam ? () => onOpenExam(x.id) : undefined}
                />
                <MasteryBar mastery={x.mastery} />
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
