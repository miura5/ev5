// A pins row (PLAN §5.10 `pins(target_c, target_id, pos, at)`, plus `v` per §data.new-tables); PK (targetC, targetId).
export type Pin = {
  /** The pinned thing's collection name (notes, sets, ...). */
  targetC: string;
  targetId: string;
  pos: number;
  at: string;
  v: number;
};
