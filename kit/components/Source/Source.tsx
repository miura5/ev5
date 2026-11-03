export interface SourceProps {
  /** The note the content came from; leave out when nothing backs it. */
  from?: string;
  onOpen?: () => void;
}

/** Where a thing came from: "from Note · title", or "unverified" when nothing backs it. */
export function Source({ from, onOpen }: SourceProps) {
  if (!from)
    return (
      <span className="kit-source kit-source-unverified" data-ui="source">
        unverified
      </span>
    );
  const text = `from Note · ${from}`;
  return onOpen ? (
    <button
      type="button"
      className="kit-source"
      data-ui="source"
      onClick={onOpen}
    >
      {text}
    </button>
  ) : (
    <span className="kit-source" data-ui="source">
      {text}
    </span>
  );
}
