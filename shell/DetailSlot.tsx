import { Detail, type DetailProps } from "../kit/index.ts";

/** The Detail beside the column: a view's opened one (animated, closable). */
export function DetailSlot({
  opened,
  onClear,
}: {
  opened: DetailProps | null;
  onClear: () => void;
}) {
  if (!opened) return null;
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
}
