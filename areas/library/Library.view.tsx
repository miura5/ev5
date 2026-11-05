import { useState } from "react";
import { Empty, Glyph, Meter, Page, Row, Tabs } from "../../kit/index.ts";
import type { Mastery } from "./types.ts";
import { PracticePanel } from "./parts/PracticePanel.tsx";
import { SetsPanel } from "./parts/SetsPanel.tsx";
import type {
  Accuracy,
  LibraryExam,
  LibrarySet,
  PracticeSession,
  WeakSpot,
} from "./types.ts";
import "./library.css";

export type {
  Accuracy,
  LibraryExam,
  LibrarySet,
  PracticeSession,
  WeakSpot,
} from "./types.ts";

export interface LibraryViewProps {
  practice: PracticeSession | null;
  weakSpots: readonly WeakSpot[];
  exams: readonly LibraryExam[];
  sets?: readonly LibrarySet[];
  accuracy?: Accuracy | null;
  onCommit?: (option: string) => void;
  onEndPractice?: () => void;
  onDrill?: (id: string) => void;
  onOpenExam?: (id: string) => void;
  onOpenSet?: (id: string) => void;
  onOpenAccuracy?: () => void;
  /** The tab to light first (an exam opened by a link lights Exams); else the one he left on. */
  initialTab?: Tab;
}

export type Tab = "practice" | "weak" | "exams" | "sets";

const TAB_KEY = "ev5.library.tab";
const TABS: readonly Tab[] = ["practice", "weak", "exams", "sets"];

function savedTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.find((x) => x === t) ?? "practice";
  } catch {
    return "practice";
  }
}

/** Library home, first slice: practice, weak spots and exams. Sets, the accuracy line and exam plans follow. */
export function LibraryView({
  practice,
  weakSpots,
  exams,
  sets = [],
  accuracy = null,
  onCommit,
  onEndPractice,
  onDrill,
  onOpenExam,
  onOpenSet,
  onOpenAccuracy,
  initialTab,
}: LibraryViewProps) {
  const [tab, setTab] = useState<Tab>(() => initialTab ?? savedTab());
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "practice", label: "Practice" },
    { id: "weak", label: "Weak spots", count: weakSpots.length },
    { id: "exams", label: "Exams", count: exams.length },
    { id: "sets", label: "Sets", count: sets.length },
  ];
  const pick = (id: string) => {
    setTab(id as Tab);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {
      /* the tab is a convenience; not saving it is fine */
    }
  };
  return (
    <Page title="Library" meta="practice, weak spots, exams and sets">
      {accuracy ? (
        <Row
          title="First-try accuracy, last 14 days"
          value={accuracy.text}
          onOpen={onOpenAccuracy}
        />
      ) : null}
      <Tabs label="Library" tabs={tabs} value={tab} onChange={pick} />
      <div data-panel={tab}>
        {tab === "practice" ? (
          <PracticePanel
            session={practice}
            onCommit={onCommit}
            onEnd={onEndPractice}
          />
        ) : null}
        {tab === "weak" && weakSpots.length === 0 ? (
          <Empty line="No weak spots." />
        ) : null}
        {tab === "weak"
          ? weakSpots.map((w) => (
              <Row
                key={w.id}
                title={w.title}
                meta={w.meta}
                value={w.due}
                glyph={<Glyph type="questions" />}
                onOpen={onDrill ? () => onDrill(w.id) : undefined}
                bar={<Mastered mastery={w.mastery} />}
              />
            ))
          : null}
        {tab === "exams" && exams.length === 0 ? (
          <Empty line="No exams." />
        ) : null}
        {tab === "exams"
          ? exams.map((x) => (
              <Row
                key={x.id}
                title={x.title}
                meta={x.meta}
                value={x.readiness}
                glyph={<Glyph type="date" />}
                onOpen={onOpenExam ? () => onOpenExam(x.id) : undefined}
                bar={<Mastered mastery={x.mastery} />}
              />
            ))
          : null}
        {tab === "sets" ? (
          <SetsPanel sets={sets} onOpenSet={onOpenSet} />
        ) : null}
      </div>
    </Page>
  );
}

/** The kit Meter for a share of right, shaky and wrong answers. */
function Mastered({ mastery: m }: { mastery: Mastery }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <Meter
      label={`Right ${pct(m.right)}, shaky ${pct(m.shaky)}, wrong ${pct(m.wrong)}`}
      parts={[
        { tone: "ok", count: m.right },
        { tone: "warn", count: m.shaky },
        { tone: "bad", count: m.wrong },
      ]}
    />
  );
}
