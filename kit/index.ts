import "./tokens/tokens.css";

/** The two themes the tokens define; set one as `data-theme` on any element. */
export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

import "./components/Button/Button.css";
import "./components/Field/Field.css";
import "./components/Toast/Toast.css";
import "./components/Source/Source.css";
import "./components/Row/Row.css";
import "./components/Tile/Tile.css";
import { Story as ButtonStory } from "./components/Button/Button.story";
import { Story as FieldStory } from "./components/Field/Field.story";
import { Story as ToastStory } from "./components/Toast/Toast.story";
import { Story as SourceStory } from "./components/Source/Source.story";
import { Story as RowStory } from "./components/Row/Row.story";
import { Story as TileStory } from "./components/Tile/Tile.story";

/** Every component's story, in gallery order; the /kit route renders each under its name. */
export const STORIES = [
  { name: "Button", Story: ButtonStory },
  { name: "Field", Story: FieldStory },
  { name: "Toast", Story: ToastStory },
  { name: "Source", Story: SourceStory },
  { name: "Row", Story: RowStory },
  { name: "Tile", Story: TileStory },
] as const;
