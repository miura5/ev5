import { Detail, type DetailProps } from "../kit/index.ts";

/** The Detail beside the column: a view's opened one (animated, closable), else the older `detail` prop until areas move. */
export function DetailSlot({
  opened,
  onClear,
  legacy,
}: {
  opened: DetailProps | null;
  onClear: () => void;
  legacy?: DetailProps | null;
}) {
  if (opened)
    return (
      <div className="shell-detail">
        <Detail
          {...opened}
          onClose={() => {
            opened.onClose?.();
            onClear();
          }}
        />
      </div>
    );
  return legacy ? <Detail {...legacy} /> : null;
}
