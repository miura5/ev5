import "./tokens/tokens.css";

/** The two themes the tokens define; set one as `data-theme` on any element. */
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

import "./components/Button/Button.css";
import "./components/Field/Field.css";
import "./components/Toast/Toast.css";
import { Story as ButtonStory } from "./components/Button/Button.story";
import { Story as FieldStory } from "./components/Field/Field.story";
import { Story as ToastStory } from "./components/Toast/Toast.story";

/** Every component's story, in gallery order; the /kit route renders each under its name. */
export const STORIES = [
  { name: "Button", Story: ButtonStory },
  { name: "Field", Story: FieldStory },
  { name: "Toast", Story: ToastStory },
] as const;
