import { Empty, PracticeCard } from "../../../kit/index.ts";
import type { PracticeSession } from "../types.ts";

export interface PracticePanelProps {
  session: PracticeSession | null;
  onCommit?: (option: string) => void;
  onEnd?: () => void;
}

/** One question in focus with its options and source; a quiet line when nothing is running. */
export function PracticePanel({
  session,
  onCommit,
  onEnd,
}: PracticePanelProps) {
  if (!session) return <Empty line="No practice running." />;
  return (
    <PracticeCard
      title={session.title}
      question={session.question}
      position={session.position}
      total={session.total}
      options={session.options}
      source={session.source}
      hint={session.hint}
      onCommit={onCommit}
      onEnd={onEnd}
    />
  );
}
