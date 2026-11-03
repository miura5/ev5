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
import "./components/Glyph/Glyph.css";
import "./components/EvLine/EvLine.css";
import "./components/StudyCard/StudyCard.css";
import "./components/Detail/Detail.css";
import "./components/Doc/Doc.css";
import "./components/Palette/Palette.css";
import { Story as ButtonStory } from "./components/Button/Button.story";
import { Story as FieldStory } from "./components/Field/Field.story";
import { Story as ToastStory } from "./components/Toast/Toast.story";
import { Story as SourceStory } from "./components/Source/Source.story";
import { Story as RowStory } from "./components/Row/Row.story";
import "./components/Suggestion/Suggestion.css";
import "./components/TextOptions/TextOptions.css";
import "./components/Menu/Menu.css";
import { Story as SuggestionStory } from "./components/Suggestion/Suggestion.story";
import { Story as TextOptionsStory } from "./components/TextOptions/TextOptions.story";
import { Story as MenuStory } from "./components/Menu/Menu.story";
import { Story as TileStory } from "./components/Tile/Tile.story";
import { Story as GlyphStory } from "./components/Glyph/Glyph.story";
import { Story as EvLineStory } from "./components/EvLine/EvLine.story";
import { Story as StudyCardStory } from "./components/StudyCard/StudyCard.story";
import { Story as DetailStory } from "./components/Detail/Detail.story";
import { Story as DocStory } from "./components/Doc/Doc.story";
import { Story as PaletteStory } from "./components/Palette/Palette.story";

/** Every component's story, in gallery order; the /kit route renders each under its name. */
export const STORIES = [
  { name: "Button", Story: ButtonStory },
  { name: "Field", Story: FieldStory },
  { name: "Toast", Story: ToastStory },
  { name: "Source", Story: SourceStory },
  { name: "Row", Story: RowStory },
  { name: "Tile", Story: TileStory },
  { name: "Suggestion", Story: SuggestionStory },
  { name: "Text options", Story: TextOptionsStory },
  { name: "Menu", Story: MenuStory },
  { name: "Glyph", Story: GlyphStory },
  { name: "E.V. line", Story: EvLineStory },
  { name: "Study card", Story: StudyCardStory },
  { name: "Detail", Story: DetailStory },
  { name: "Doc", Story: DocStory },
  { name: "Palette", Story: PaletteStory },
] as const;

export { Row } from "./components/Row/Row";
export { Glyph, type GlyphType } from "./components/Glyph/Glyph";
export { Detail, type DetailProps } from "./components/Detail/Detail";
export { Palette, type PaletteGroup } from "./components/Palette/Palette";
export { Button } from "./components/Button/Button";
export { Source } from "./components/Source/Source";
export { Doc } from "./components/Doc/Doc";
export { EvLine } from "./components/EvLine/EvLine";
export { Suggestion } from "./components/Suggestion/Suggestion";
export { Tile } from "./components/Tile/Tile";
export { TextOptions } from "./components/TextOptions/TextOptions";
