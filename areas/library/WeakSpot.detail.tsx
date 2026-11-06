import { Button, MovePicker, type DetailProps } from "../../kit/index.ts";
import { kindOffers } from "../../domain/index.ts";
import type { LibraryExam, WeakSpot } from "./types.ts";

/**
 * A weak spot's Detail: when it is next due, and the date it matters for. Only a date whose kind offers weak-spot links
 * is listed; the one it is on now stays listed so it can be changed. Picking "No date" ends the link.
 */
export function weakSpotDetail({
  spot,
  dates,
  onLink,
  onClose,
}: {
  spot: WeakSpot;
  dates: readonly LibraryExam[];
  onLink: (goalId: string | null) => void;
  onClose?: () => void;
}): DetailProps {
  const here = dates.find((d) => d.id === spot.goalId);
  const targets = dates
    .filter((d) => d.id === spot.goalId || kindOffers(d.kind, "weak-spot-links"))
    .map((d) => ({ id: d.id, title: d.title }));
  return {
    title: spot.title,
    onClose,
    properties: [
      { label: "Next", value: spot.due },
      { label: "Matters for", value: here?.title ?? "no date" },
    ],
    children: (
      <MovePicker
        label="Matters for"
        targets={targets}
        current={spot.goalId}
        noneLabel="No date"
        onMove={onLink}
        trigger={<Button>Change date</Button>}
      />
    ),
  };
}
