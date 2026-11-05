import { useEffect, useState } from "react";
import { Detail, type DetailProps } from "../../kit/index.ts";
import { TodayScreen } from "./Today.screen.tsx";

/** Stands in for the shell in tests: holds the Detail the screen opens, closes it on Esc like the shell's host. */
export function TodayHosted(props: Parameters<typeof TodayScreen>[0]) {
  const [detail, setDetail] = useState<DetailProps | null>(null);
  useEffect(() => {
    if (!detail) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [detail]);
  return (
    <>
      <TodayScreen {...props} onDetail={setDetail} />
      {detail ? (
        <Detail
          {...detail}
          onClose={() => {
            detail.onClose?.();
            setDetail(null);
          }}
        />
      ) : null}
    </>
  );
}
