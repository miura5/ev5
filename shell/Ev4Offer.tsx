import { useEffect, useState } from "react";
import { Button } from "../kit/index.ts";
import type { Ev4Entry } from "./outbox/index.ts";
import type { Services } from "./services.ts";

type Phase = "none" | "offer" | "working" | "done" | "failed";

/** First boot: if ev4 left unsent notes on this device, ask once. Nothing is queued until Matt says yes. */
export function Ev4Offer({ ev4 }: { ev4: Services["ev4"] }) {
  const [entries, setEntries] = useState<Ev4Entry[]>([]);
  const [phase, setPhase] = useState<Phase>("none");
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    let live = true;
    void ev4?.find().then((found) => {
      if (live && found.length > 0) {
        setEntries(found);
        setPhase("offer");
      }
    });
    return () => {
      live = false;
    };
  }, [ev4]);
  if (!ev4 || phase === "none") return null;
  const n = entries.length;
  const notes = `${n} unsent ${n === 1 ? "note" : "notes"}`;
  const yes = async () => {
    setPhase("working");
    try {
      setQueued((await ev4.accept(entries)).queued);
      setPhase("done");
    } catch {
      setPhase("failed"); // nothing is remembered, so the offer is still there to retry
    }
  };
  return (
    <div className="shell-offer" role="status" data-ui="ev4-offer">
      {phase === "done" ? (
        <span>
          Queued {queued} {queued === 1 ? "note" : "notes"} from the old E.V.;
          they send when you are online.
        </span>
      ) : (
        <>
          <span>
            {phase === "failed"
              ? "That did not work; nothing was changed. Try again?"
              : `The old E.V. left ${notes} on this device. Bring ${n === 1 ? "it" : "them"} over?`}
          </span>
          <Button
            kind="primary"
            disabled={phase === "working"}
            onClick={() => void yes()}
          >
            Yes, bring over
          </Button>
          <Button
            kind="text"
            disabled={phase === "working"}
            onClick={() => {
              ev4.decline();
              setPhase("none");
            }}
          >
            No thanks
          </Button>
        </>
      )}
    </div>
  );
}
