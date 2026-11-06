/** What a draft is for: an unverified set item, or a Suggestion (a command E.V. proposes, §cmd.propose). */
export const DRAFT_KINDS = ['set-item', 'suggestion'] as const;

export const DRAFT_STATES = ['pending', 'kept', 'dropped'] as const;
