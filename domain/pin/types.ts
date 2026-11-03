// A pins row (PLAN §5.10 `pins(target_c, target_id, pos, at)`); the sidebar lists them in `pos` order.
export type Pin = {
  /** The target's collection name (ev4 `c`, or a v5 table such as "collections"). */
  targetC: string;
  targetId: string;
  pos: number;
  at: string;
};

/** What the rules read of a pin's target: whether it exists and whether Matt deleted it (§delete.soft). */
export type TargetState = 'live' | 'deleted' | 'missing';
