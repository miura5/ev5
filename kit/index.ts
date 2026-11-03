import "./tokens/tokens.css";

/** The two themes the tokens define; set one as `data-theme` on any element. */
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];
